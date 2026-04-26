import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

        // ── LAYER 2: Full Transcript Data (For Prompt Caching) ───────────
        // Fetch ALL raw transcripts for this project to leverage Prompt Caching.
        const allTranscripts = await prisma.transcript.findMany({
            where: { dataset: { projectId } },
            select: { id: true, title: true, content: true, status: true }
        })

        const transcriptsContext = allTranscripts.length > 0
            ? allTranscripts.map(t => `--- BEGIN TRANSCRIPT: "${t.title}" (ID: ${t.id}) ---\n${t.content}\n--- END TRANSCRIPT: "${t.title}" ---`).join('\n\n')
            : 'No transcripts available.'

        // ── LAYER 3: Build Rich System Prompt ─────────────────────────────
        const codebookContext = codebook.length > 0
            ? codebook.map(c => `  - ${c.name} (${c.type}): ${c.definition || 'No definition'}`).join('\n')
            : '  No codes created yet.'

        const themesContext = themes.length > 0
            ? themes.map((t: any) => `  - ${t.name}: ${t.description || 'No description'}`).join('\n')
            : '  No themes created yet.'

        const systemPrompt = `You are an expert qualitative research analyst embedded in QualiSIS, a thematic analysis platform.

You are assisting the researcher working on the project: "${project.name}"
${project.description ? `Project Description: ${project.description}` : ''}
${(project as any).researchQuestion ? `Research Question: ${(project as any).researchQuestion}` : ''}

━━━ LAYER 1: PROJECT KNOWLEDGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CODEBOOK (${codebook.length} codes):
${codebookContext}

THEMES (${themes.length} themes):
${themesContext}

━━━ LAYER 2: FULL RAW DATA (PROMPT CACHING ENABLED) ━━━━━━━━
Below are the complete, raw transcripts for this project.
Because you have access to the full text, you must perform exhaustive semantic reading across ALL provided transcripts to answer the researcher's questions. Do not miss any relevant details, even if they have not been formally coded yet.

${transcriptsContext}

━━━ YOUR ROLE & INSTRUCTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are NOT a generic chatbot. You are a qualitative research analyst who:

1. GROUNDS answers in actual data: Always cite specific quotes from the raw transcripts when discussing patterns. Format citations EXACTLY as standard Markdown links on a single line pointing to the transcript URL with the quote parameter: *"[quote]"* — [Transcript Title](/projects/${projectId}/transcripts/[ID]?quote=[quote_url_encoded]) (Replace [ID] with the actual ID. The URL must NOT contain spaces; you must URL-encode the quote parameter replacing spaces with %20). Do NOT use double brackets.
2. REASONS analytically: Synthesize, compare across participants, identify contradictions, and offer interpretive insights.
3. SUPPORTS methodology: Help with Braun & Clarke's RTA phases, reflexivity, codebook refinement, theme naming, and narrative writing.
4. THINKS across transcripts: Look for patterns that appear in multiple transcripts.

When the researcher asks a question:
- Exhaustively scan the FULL transcripts provided above.
- Identify relevant quotes and patterns, regardless of whether they are in the codebook.
- Synthesize what multiple participants say.
- Note agreements, tensions, and contradictions.
- Always be academically rigorous, empathetic to participants, and reflexively aware of interpretation.`

        
        const latestUserMessage = messages[messages.length - 1]
        
        // Save user message to DB
        await prisma.chatMessage.create({
            data: {
                projectId,
                userId: (session.user as any).id,
                role: 'user',
                content: latestUserMessage.content
            }
        })

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

        // Save AI response to DB
        await prisma.chatMessage.create({
            data: {
                projectId,
                userId: (session.user as any).id,
                role: 'assistant',
                content: responseText
            }
        })


        return NextResponse.json({ 
            role: 'assistant', 
            content: responseText,
            meta: {
                transcriptsAnalyzed: allTranscripts.length,
                promptCaching: "Enabled via Context Prefix"
            }
        })

    } catch (error: any) {
        console.error('Chat error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function GET(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const messages = await prisma.chatMessage.findMany({
            where: { projectId: params.projectId, userId: (session.user as any).id },
            orderBy: { createdAt: 'asc' }
        })
        
        return NextResponse.json(messages.map(m => ({ role: m.role, content: m.content })))
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        await prisma.chatMessage.deleteMany({
            where: { projectId: params.projectId, userId: (session.user as any).id }
        })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
