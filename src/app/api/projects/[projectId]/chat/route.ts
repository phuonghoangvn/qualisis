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

        // Fetch user basic info
        const user = await prisma.user.findUnique({
            where: { id: (session.user as any).id }
        })

        // Fetch some project context (Codebook and all Dataset Titles)
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                datasets: {
                    select: { name: true, transcripts: { select: { title: true } } }
                }
            }
        })
        
        const codebooks = await prisma.codebookEntry.findMany({
            where: { projectId: projectId }
        })

        if (!project) throw new Error('Project not found')

        const codebookContext = codebooks.map(c => `- ${c.name} (Type: ${c.type}): ${c.definition || 'No description'}`).join('\n')
        const datasetsContext = project.datasets.map(d => `Dataset: ${d.name}\nTranscripts: ${d.transcripts.map(t => t.title).join(', ')}`).join('\n\n')

        // System prompt with project context
        const systemPrompt = `You are a helpful Research Assistant for QualiSIS, an AI workstation for qualitative research.
You are chatting with the researcher of the project "${project.name}".
Your goal is to help them brainstorm, analyze, and query their data.

Here is the context about this project:
Description: ${project.description || 'N/A'}

--- CURRENT CODEBOOK ---
${codebookContext}

--- DATASETS AND TRANSCRIPTS ---
${datasetsContext}

You can help the user refine their codebook, answer methodological questions, or brainstorm themes.
Be professional, concise, and academically rigorous.
If you need specific quotes or segments, ask the user to search for them or provide them.`

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages.map((m: any) => ({ role: m.role, content: m.content }))
            ]
        })
        
        const responseText = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'

        return NextResponse.json({ role: 'assistant', content: responseText })

    } catch (error: any) {
        console.error('Chat error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
