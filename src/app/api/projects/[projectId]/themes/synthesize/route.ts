export const maxDuration = 60;
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { openai } from '@/lib/ai'

export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const body = await req.json().catch(() => ({}))

        // Get all themes with their code counts
        const currentThemes = await prisma.theme.findMany({
            where: { projectId: params.projectId },
            include: {
                codeLinks: {
                    include: {
                        codebookEntry: true
                    }
                }
            }
        });

        if (currentThemes.length < 3) {
            return NextResponse.json({ message: 'Need at least 3 themes to synthesize into higher-order categories.' }, { status: 400 });
        }

        const themesSummary = currentThemes.map(t => {
            const codes = t.codeLinks.map((l: any) => l.codebookEntry.name).join(', ');
            return `Theme Name: "${t.name}"\nDescription: ${t.description || 'N/A'}\nContains Codes: [${codes}]`;
        }).join('\n\n');

        const project = await prisma.project.findUnique({
            where: { id: params.projectId },
            select: { name: true, description: true, researchQuestion: true }
        });

        const prompt = `[ROLE]
You are a senior qualitative researcher consolidating a fragmented thematic map. The researcher has created too many narrow sub-themes (${currentThemes.length} in total), and needs you to synthesize and group them into 3-6 HIGHER-ORDER OVERARCHING THEMES.

[CONTEXT]
Project: ${project?.name}
${project?.researchQuestion ? `RQ: ${project.researchQuestion}\n` : ''}

[CURRENT THEMES]
${themesSummary}

[TASK]
Group the above themes into 3-6 Overarching Themes.
For each new Overarching Theme, specify WHICH of the exact original themes belong inside it.
An original theme can ONLY belong to one Overarching Theme.

[OUTPUT FORMAT]
Return ONLY a JSON array with this structure (no markdown tags):
[
  {
    "name": "New Mega-Theme Name",
    "description": "Comprehensive description of this overarching theme...",
    "mergedThemeIds": ["Exact Name of Theme 1", "Exact Name of Theme 2"]
  }
]
`;

        if (!openai) {
            return NextResponse.json({ error: 'AI is not configured' }, { status: 500 });
        }

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.3,
            messages: [{ role: 'user', content: prompt }],
        });

        const raw = response.choices[0]?.message?.content ?? '[]';
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const suggestions = JSON.parse(cleaned);

        // Process suggestions to map back to real Theme IDs
        const enriched = suggestions.map((s: any) => {
            const matchedIds = s.mergedThemeIds.map((name: string) => {
                const match = currentThemes.find(t => t.name.toLowerCase() === name.toLowerCase());
                return match ? match.id : null;
            }).filter(Boolean);

            const matchedThemesObj = currentThemes.filter(t => matchedIds.includes(t.id));

            return {
                name: s.name,
                description: s.description,
                matchedThemes: matchedThemesObj.map(t => ({ id: t.id, name: t.name })),
                matchedIds
            };
        });

        return NextResponse.json({ suggestions: enriched, success: true });

    } catch (e) {
        console.error('Theme synthesize error:', e);
        return NextResponse.json({ error: 'Failed to synthesize themes' }, { status: 500 });
    }
}
