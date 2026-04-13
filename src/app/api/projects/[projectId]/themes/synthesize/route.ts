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
            where: { 
                projectId: params.projectId,
                status: { not: 'MERGED' }
            },
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
            return `[ID: ${t.id}] Theme Name: "${t.name}"\nDescription: ${t.description || 'N/A'}\nContains Codes: [${codes}]`;
        }).join('\n\n');

        const project = await prisma.project.findUnique({
            where: { id: params.projectId },
            select: { name: true, description: true, researchQuestion: true }
        });

        const narrativeLenses = [
            "Chronological/Evolutionary (Focus on how phenomena evolve over time or progressing stages).",
            "Conflict & Resolution (Focus on paradoxes, tensions, and coping mechanisms).",
            "Cause & Effect (Focus on underlying drivers, mechanisms, and distinct outcomes).",
            "Socio-ecological / Systemic (Focus on individual experiences versus systemic/institutional environments).",
            "Action & Perspective (Focus on what participants DO versus what they BELIEVE or FEAR)."
        ];
        
        // Randomly pick a framing lens to ensure "Try again" produces a vastly different structural concept
        const randomLens = narrativeLenses[Math.floor(Math.random() * narrativeLenses.length)];

        const prompt = `[ROLE]
You are a senior qualitative methodologist organizing a thematic map. Your goal is to group granular sub-themes into a cohesive, high-level categorical structure based on SEMANTIC AND CONCEPTUAL SIMILARITY.

[CONTEXT]
Project: ${project?.name}
${project?.researchQuestion ? `RQ: ${project.researchQuestion}\n` : ''}

[CURRENT THEMES]
${themesSummary}

[TASK]
Synthesize the ${currentThemes.length} fragmented sub-themes into 3-6 HIGHER-ORDER MEGA-THEMES.

1. SEMANTIC CLUSTERING: Look at the codes inside each theme. Group themes together if they share similar underlying meanings, address the same phenomena, or are conceptually adjacent.
2. If using a specific lens like "${randomLens}", apply it to define the RELATIONSHIP between the clusters.

[CONSTRAINTS]
- Group things that are ACTUALLY similar in context. Do not force an abstract narrative if the themes naturally form a clear categorical bucket.
- THEME NAMING RULE: Stop using big academic words or jargon like "Complicate Collaboration", "Dynamics", or "Enhance". The Mega-Theme name MUST be an extremely transparent, plain-English sentence that explicitly states what happened. (e.g., "Users rely on their own judgment rather than trusting AI" or "Being familiar with the data makes using AI much easier"). 
- An original theme MUST belong to exactly ONE Overarching Theme.
- You must include ALL original themes across your groupings. Do not drop any.

Return ONLY a strict JSON array (no markdown tags) with this structure:
[
  {
    "name": "Plain-English Finding Name (e.g., 'Users rely on their own judgment because they do not trust AI outputs')",
    "description": "A crystal clear, straightforward 2-3 sentence explanation of the overarching meaning. EXACTLY what do these sub-themes have in common and what is the core finding?",
    "mergedThemeIds": ["theme-id-1", "theme-id-2"]
  }
]`;

        if (!openai) {
            return NextResponse.json({ error: 'AI is not configured' }, { status: 500 });
        }

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.85, // High temp combined with random lens ensures very distinct variations on "Try again"
            messages: [{ role: 'user', content: prompt }],
        });

        const raw = response.choices[0]?.message?.content ?? '[]';
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const suggestions = JSON.parse(cleaned);

        // Process suggestions to map back to real Theme IDs
        const enriched = suggestions.map((s: any) => {
            const rawIds: string[] = Array.isArray(s.mergedThemeIds) ? s.mergedThemeIds : [];

            // Primary: try matching by ID directly
            let matchedThemesObj = currentThemes.filter(t => rawIds.includes(t.id));

            // Fallback: if AI returned theme names instead of IDs, match by name
            if (matchedThemesObj.length === 0 && rawIds.length > 0) {
                matchedThemesObj = currentThemes.filter(t =>
                    rawIds.some(raw => t.name.toLowerCase().trim() === raw.toLowerCase().trim())
                );
            }

            return {
                name: s.name,
                description: s.description,
                matchedThemes: matchedThemesObj.map(t => ({ id: t.id, name: t.name })),
                matchedIds: matchedThemesObj.map(t => t.id)
            };
        }).filter((s: { matchedIds: string[] }) => s.matchedIds.length >= 2); // Only include suggestions that matched at least 2 real themes

        return NextResponse.json({ suggestions: enriched, success: true });

    } catch (e) {
        console.error('Theme synthesize error:', e);
        return NextResponse.json({ error: 'Failed to synthesize themes' }, { status: 500 });
    }
}
