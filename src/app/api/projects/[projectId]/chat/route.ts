import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Simple keyword relevance score between a query and a piece of text
function relevanceScore(query: string, text: string): number {
    const stopWords = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was', 'were', 'have', 'has', 'had', 'what', 'how', 'when', 'who', 'where', 'why', 'can', 'did', 'does', 'about'])
    const queryWords = query.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w))
    if (queryWords.length === 0) return 0
    const lowerText = text.toLowerCase()
    return queryWords.filter(w => lowerText.includes(w)).length / queryWords.length
}

export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { messages } = await req.json()
        const projectId = params.projectId

        // ── LAYER 1: Structured Project Knowledge ──────────────────────────
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                datasets: {
                    include: {
                        transcripts: {
                            select: { id: true, title: true, status: true }
                        }
                    }
                }
            }
        })
        if (!project) throw new Error('Project not found')

        // Codebook (all codes with definitions)
        const codebook = await prisma.codebookEntry.findMany({
            where: { projectId },
            orderBy: { name: 'asc' }
        })

        // Themes (with descriptions if stored as project-level themes)
        const themes = await prisma.theme.findMany({
            where: { projectId }
        }).catch(() => [] as any[])

        // ── LAYER 2: RAG-lite — Retrieve Relevant Coded Segments ───────────
        // Fetch all coded/accepted segments from this project
        const allCodedSegments = await prisma.segment.findMany({
            where: {
                transcript: { dataset: { projectId } },
                OR: [
                    { codeAssignments: { some: {} } },
                    { suggestions: { some: { status: { in: ['APPROVED', 'MODIFIED'] } } } }
                ]
            },
            include: {
                transcript: { select: { title: true } },
                codeAssignments: { include: { codebookEntry: true } },
                suggestions: { where: { status: { in: ['APPROVED', 'MODIFIED'] } } }
            },
            take: 300 // Cap to avoid excessive DB load
        })

        // Score and rank segments by relevance to the latest user query
        const latestUserMessage = [...messages].reverse().find((m: any) => m.role === 'user')?.content || ''
        const scoredSegments = allCodedSegments
            .map(seg => ({
                seg,
                score: relevanceScore(latestUserMessage, seg.text)
            }))
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 20) // Top 20 most relevant

        // If no relevant segments found by keyword, include a random sample for context
        const contextSegments = scoredSegments.length > 0
            ? scoredSegments.map(s => s.seg)
            : allCodedSegments.slice(0, 10)

        // Format retrieved segments as grounded evidence
        const retrievedEvidenceText = contextSegments.map(seg => {
            const codeName = seg.codeAssignments[0]?.codebookEntry?.name
                ?? seg.suggestions[0]?.label
                ?? 'Uncoded'
            const transcriptTitle = seg.transcript?.title ?? 'Unknown Transcript'
            return `• [${transcriptTitle}] Code: "${codeName}"\n  Quote: "${seg.text.substring(0, 200)}"`
        }).join('\n\n')

        // ── LAYER 3: Build Rich System Prompt ─────────────────────────────
        const codebookContext = codebook.length > 0
            ? codebook.map(c => `  - ${c.name} (${c.type}): ${c.definition || 'No definition'}`).join('\n')
            : '  No codes created yet.'

        const themesContext = themes.length > 0
            ? themes.map((t: any) => `  - ${t.name}: ${t.description || 'No description'}`).join('\n')
            : '  No themes created yet.'

        const transcriptList = project.datasets.flatMap(d =>
            d.transcripts.map(t => `  - "${t.title}" (${t.status})`)
        ).join('\n') || '  No transcripts uploaded yet.'

        const totalCoded = allCodedSegments.length

        const systemPrompt = `You are an expert qualitative research analyst embedded in QualiSIS, a thematic analysis platform.

You are assisting the researcher working on the project: "${project.name}"
${project.description ? `Project Description: ${project.description}` : ''}
${(project as any).researchQuestion ? `Research Question: ${(project as any).researchQuestion}` : ''}

━━━ LAYER 1: PROJECT KNOWLEDGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSCRIPTS (${project.datasets.flatMap(d => d.transcripts).length} total):
${transcriptList}

CODEBOOK (${codebook.length} codes):
${codebookContext}

THEMES (${themes.length} themes):
${themesContext}

━━━ LAYER 2: RETRIEVED EVIDENCE FROM DATA ━━━━━━━━━━━━━━━━━━
The following ${contextSegments.length} coded excerpts from the data are most relevant to the researcher's current question (retrieved from ${totalCoded} total coded segments across all transcripts):

${retrievedEvidenceText || 'No coded segments found yet. Ask the researcher to run AI analysis on their transcripts first.'}

━━━ YOUR ROLE & INSTRUCTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are NOT a generic chatbot. You are a qualitative research analyst who:

1. GROUNDS answers in actual data: Always cite specific quotes from the retrieved evidence above when discussing patterns. Format citations as: *"[quote]"* — [Transcript Title]
2. REASONS analytically: Don't just retrieve — synthesize, compare across participants, identify contradictions, and offer interpretive insights.
3. ACKNOWLEDGES limitations: If the retrieved data doesn't fully answer the question, say so clearly and suggest what the researcher could look for.
4. SUPPORTS methodology: Help with Braun & Clarke's RTA phases, reflexivity, codebook refinement, theme naming, and narrative writing.
5. THINKS across transcripts: Look for patterns that appear in multiple transcripts, not just single quotes.

When the researcher asks "what do participants say about X", you should:
- Search through the retrieved evidence above
- Identify relevant quotes and patterns  
- Synthesize what multiple participants say
- Note agreements, tensions, and contradictions
- Suggest what this means analytically

Always be academically rigorous, empathetic to participants, and reflexively aware of interpretation.`

        // ── Call GPT-4o (not mini) for deeper reasoning ───────────────────
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.4,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages.map((m: any) => ({ role: m.role, content: m.content }))
            ]
        })

        const responseText = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'

        return NextResponse.json({ 
            role: 'assistant', 
            content: responseText,
            meta: {
                segmentsRetrieved: contextSegments.length,
                totalCodedSegments: totalCoded,
                relevantByKeyword: scoredSegments.length
            }
        })

    } catch (error: any) {
        console.error('Chat error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
