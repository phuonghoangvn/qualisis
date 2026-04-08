import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { openai } from '@/lib/ai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const userId = session?.user ? (session.user as any).id : null;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const { text, projectId } = body;

        if (!text || !projectId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Fetch project to get ontology
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        // Get the latest few human code assignments from this project to build few-shot examples
        const recentAssignments = await prisma.codeAssignment.findMany({
            where: {
                segment: { transcript: { dataset: { projectId } } }
            },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { segment: true, codebookEntry: true }
        });

        const historyContextText = recentAssignments.length > 0
            ? "Recent codes applied by this researcher:\n" + recentAssignments.map(a => `- Text: "${a.segment.text}" => Code: "${a.codebookEntry.name}"`).join('\n')
            : "No previous codes in this project yet.";

        let projectContext = "";
        if (project?.coreOntology) projectContext += `Core Ontology: ${project.coreOntology}\n`;
        if (project?.researchQuestion) projectContext += `Research Question: ${project.researchQuestion}\n`;

        const prompt = `You are a helpful AI assistant for Qualitative Data Analysis (Reflexive Thematic Analysis).
Your task is to suggest 3 precise, highly descriptive, sentence-like thematic code labels (5-12 words) for the provided text snippet.
Do NOT reduce them into short 1-2 word abstract tags. Follow the researcher's style based on their recent codes if available.

${projectContext}
${historyContextText}

New Text to Code: "${text}"

Output your suggestions as a JSON object: { "suggestions": ["Descriptive Label 1", "Descriptive Label 2", "Descriptive Label 3"] }`;

        if (!openai) {
            return NextResponse.json({ suggestions: ["Theme 1", "Theme 2", "Theme 3"] });
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: "You output JSON only." },
                { role: "user", content: prompt }
            ],
            temperature: 0.3
        });

        const result = JSON.parse(completion.choices[0].message?.content || '{"suggestions":[]}');
        return NextResponse.json({ suggestions: result.suggestions || [] });

    } catch (e) {
        console.error('Suggest Code Error:', e);
        return NextResponse.json({ suggestions: [] }, { status: 500 });
    }
}
