import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Helper: embed a query and retrieve top-K semantically similar segments ──
async function retrieveRelevantSegments(
    projectId: string,
    query: string,
    topK: number = 20
): Promise<{ text: string; speaker: string | null; transcriptTitle: string; transcriptId: string; score: number }[]> {
    // Embed the user query
    const embRes = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
        dimensions: 1536,
    })
    const queryVector = `[${embRes.data[0].embedding.join(',')}]`

    // Cosine similarity search across all segments in this project
    // Uses pgvector's <=> operator (cosine distance, lower = more similar)
    const results: any[] = await prisma.$queryRawUnsafe(`
        SELECT
            seg.id,
            seg.text,
            seg.speaker,
            t.id   AS "transcriptId",
            t.title AS "transcriptTitle",
            1 - (seg.embedding <=> $1::vector) AS score
        FROM "Segment" seg
        JOIN "Transcript" t ON seg."transcriptId" = t.id
        JOIN "Dataset" d ON t."datasetId" = d.id
        WHERE d."projectId" = $2
          AND seg.embedding IS NOT NULL
        ORDER BY seg.embedding <=> $1::vector
        LIMIT $3
    `, queryVector, projectId, topK)

    return results
}

// ── Check if the project has any embedded segments ──────────────────────────
async function hasEmbeddings(projectId: string): Promise<boolean> {
    const rows: any[] = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) AS count
        FROM "Segment" seg
        JOIN "Transcript" t ON seg."transcriptId" = t.id
        JOIN "Dataset" d ON t."datasetId" = d.id
        WHERE d."projectId" = $1
          AND seg.embedding IS NOT NULL
    `, projectId)
    return Number(rows[0]?.count ?? 0) > 0
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
                    include: { transcripts: { select: { id: true, title: true, status: true } } }
                }
            }
        })
        if (!project) throw new Error('Project not found')

        const codebook = await prisma.codebookEntry.findMany({
            where: { projectId },
            orderBy: { name: 'asc' }
        })

        const themes = await prisma.theme.findMany({ where: { projectId } }).catch(() => [] as any[])

        const codebookContext = codebook.length > 0
            ? codebook.map(c => `  - **${c.name}** (${c.type}): ${c.definition || 'No definition'}`).join('\n')
            : '  No codes created yet.'

        const themesContext = themes.length > 0
            ? themes.map((t: any) => `  - ${t.name}: ${t.description || 'No description'}`).join('\n')
            : '  No themes created yet.'

        // ── LAYER 2: Semantic Retrieval ────────────────────────────────────
        // Extract the user's latest message for retrieval
        const latestUserMessage = messages[messages.length - 1]
        const userQuery = latestUserMessage.content

        let retrievalContext = ''
        let retrievalMode = 'none'
        let segmentsRetrieved = 0

        const embeddingsAvailable = await hasEmbeddings(projectId)

        if (embeddingsAvailable) {
            // Semantic search: find the most relevant transcript segments
            const relevantSegments = await retrieveRelevantSegments(projectId, userQuery, 20)
            segmentsRetrieved = relevantSegments.length

            if (relevantSegments.length > 0) {
                retrievalMode = 'semantic'
                retrievalContext = relevantSegments
                    .map((seg, i) => {
                        const speaker = seg.speaker ? `[${seg.speaker}] ` : ''
                        const similarity = Math.round(seg.score * 100)
                        return `[${i + 1}] (${seg.transcriptTitle} | ID: ${seg.transcriptId} | Match: ${similarity}%)\n${speaker}"${seg.text}"`
                    })
                    .join('\n\n')
            }
        } else {
            // Fallback: inject all transcripts (old behaviour for projects without embeddings)
            retrievalMode = 'full-text-fallback'
            const allTranscripts = await prisma.transcript.findMany({
                where: { dataset: { projectId } },
                select: { id: true, title: true, content: true }
            })
            retrievalContext = allTranscripts
                .map(t => `--- TRANSCRIPT: "${t.title}" (ID: ${t.id}) ---\n${t.content}`)
                .join('\n\n')
        }

        // ── LAYER 3: Build System Prompt ───────────────────────────────────
        const transcriptList = project.datasets
            .flatMap(d => d.transcripts)
            .map(t => `  - ${t.title} (${t.status})`)
            .join('\n')

        const systemPrompt = `You are an expert qualitative research analyst embedded in QualiSIS, a thematic analysis platform.

You are assisting the researcher working on the project: "${project.name}"
${project.description ? `Project Description: ${project.description}` : ''}
${(project as any).researchQuestion ? `Research Question: ${(project as any).researchQuestion}` : ''}

━━━ PROJECT KNOWLEDGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSCRIPTS IN PROJECT:
${transcriptList || '  No transcripts yet.'}

CODEBOOK (${codebook.length} codes):
${codebookContext}

THEMES (${themes.length} themes):
${themesContext}

━━━ RETRIEVED EVIDENCE (Semantic Search Results) ━━━━━━━━━━━━━
${retrievalMode === 'semantic'
    ? `The following ${segmentsRetrieved} transcript segments were retrieved as the most semantically relevant to the researcher's question. They are ranked by relevance (Match %):\n\n${retrievalContext}`
    : `Full transcript content (embeddings not yet generated for this project):\n\n${retrievalContext}`
}

━━━ YOUR ROLE & INSTRUCTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are NOT a generic chatbot. You are a qualitative research analyst who:

1. GROUNDS answers in actual data: Always cite specific quotes from the retrieved segments above when discussing patterns.
   Format citations EXACTLY as standard Markdown links on a single line:
   *"[quote]"* — [Transcript Title](/projects/${projectId}/transcripts/[ID]?quote=[quote_url_encoded])
   Replace [ID] with the actual transcript ID. URL-encode the quote (spaces → %20, quotes → %22). Do NOT use double brackets [[ ]].

2. REASONS analytically: Synthesize across participants, identify contradictions and patterns.

3. SUPPORTS methodology: Help with Braun & Clarke's RTA phases, reflexivity, codebook refinement, and theme naming.

4. ACKNOWLEDGES limitations: If the retrieved segments don't fully answer the question, say so. Suggest the researcher rephrase or look at specific transcripts.

5. USES the codebook: Reference established codes and themes when relevant.`

        // Save user message to DB
        await prisma.chatMessage.create({
            data: {
                projectId,
                userId: (session.user as any).id,
                role: 'user',
                content: userQuery
            }
        })

        // ── Call GPT-4o ────────────────────────────────────────────────────
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
                retrievalMode,
                segmentsRetrieved,
                embeddingsAvailable,
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
