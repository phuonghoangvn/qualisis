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

        const personas = [
            {
                id: "Psych",
                icon: "🧠",
                desc: "Focus purely on emotions, internal psychological states, implicit feelings, and mental framing."
            },
            {
                id: "Socio",
                icon: "👥",
                desc: "Focus on social structures, workplace dynamics, cultural norms, relationships, and systemic pressures."
            },
            {
                id: "Skeptic",
                icon: "🕵️",
                desc: "Focus on contradictions, what is NOT being said, paradoxes, avoidance, and underlying motives."
            }
        ];

        if (!openai) {
            return NextResponse.json({ suggestions: ["🧠 [Psych] Fallback Code", "👥 [Socio] Fallback Code", "🕵️ [Skeptic] Fallback Code"] });
        }

        const completions = await Promise.all(personas.map(p => {
            const prompt = `You are a specialized Qualitative Researcher persona: ${p.id}. 
${p.desc}
Your task is to suggest EXACTLY ONE highly descriptive, sentence-like thematic code label (4-8 words) for the provided text snippet from your specific theoretical perspective.
Do NOT reduce it into a short 1-2 word tag.

${projectContext}
${historyContextText}

New Text to Code: "${text}"

Output your suggestion as a JSON object: { "suggestion": "Descriptive Label Here" }`;

            return openai!.chat.completions.create({
                model: "gpt-4o-mini",
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: "You output JSON only." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.6 // Slightly higher to encourage creative distinctiveness
            });
        }));

        const results = completions.map((c, i) => {
            const res = JSON.parse(c.choices[0].message?.content || '{"suggestion": "Unknown"}');
            const label = res.suggestion;
            return `${personas[i].icon} [${personas[i].id}] ${label}`;
        });

        return NextResponse.json({ suggestions: results });

    } catch (e) {
        console.error('Suggest Code Error:', e);
        return NextResponse.json({ suggestions: [] }, { status: 500 });
    }
}
