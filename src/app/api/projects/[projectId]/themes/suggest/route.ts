export const maxDuration = 60; // Max allowed for Vercel Hobby
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { openai } from '@/lib/ai'

// Batch size: how many codes to send per AI call to avoid context-window limits.
// gpt-4o-mini context is ~128k tokens. 80 codes × ~200 tokens = ~16k — safe.
const MAX_CODES_PER_BATCH = 80

// POST /api/projects/[projectId]/themes/suggest — AI suggests theme groupings
export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const body = await req.json().catch(() => ({}))
        const { customPrompt, rejectedNames, batchOffset = 0 } = body || {}

        // 1. Get all codebook entries for this project
        const codebookEntries = await prisma.codebookEntry.findMany({
            where: { projectId: params.projectId },
            include: {
                codeAssignments: {
                    include: {
                        segment: { select: { text: true, transcriptId: true } },
                        aiSuggestion: { select: { uncertainty: true } }
                    },
                    take: 3 // limit examples per code to keep prompt compact
                },
                _count: { select: { codeAssignments: true } },
                // Include themeLinks with theme status to correctly identify unassigned codes
                themeLinks: {
                    include: {
                        theme: { select: { status: true } }
                    }
                }
            }
        })

        if (codebookEntries.length === 0) {
            return NextResponse.json({ suggestions: [], message: 'No codes found in this project' })
        }

        // 2. Keep only truly unassigned codes:
        //    - Has at least 1 assignment (not a ghost/orphan code)
        //    - Not linked to any NON-MERGED theme (MERGED themes are historical — codes should be re-groupable)
        const allUnassigned = codebookEntries
            .filter(c =>
                c._count.codeAssignments > 0 &&
                !c.themeLinks.some((tl: any) => tl.theme.status !== 'MERGED')
            )
            // Sort by most-used first so the most relevant codes go in the first batch
            .sort((a, b) => b._count.codeAssignments - a._count.codeAssignments)

        if (allUnassigned.length < 2) {
            return NextResponse.json({
                suggestions: [],
                message: 'Need at least 2 unassigned codes to generate theme suggestions'
            })
        }

        // 3. Slice the batch for this request
        const batchStart = batchOffset
        const batchCodes = allUnassigned.slice(batchStart, batchStart + MAX_CODES_PER_BATCH)
        const remainingAfterBatch = Math.max(0, allUnassigned.length - (batchStart + MAX_CODES_PER_BATCH))

        // Build a CONCISE code list (skip full example quotes for large batches to save tokens)
        const useLongFormat = batchCodes.length <= 30
        const codesSummary = batchCodes.map(code => {
            const examples = useLongFormat
                ? code.codeAssignments
                    .map((a: any) => `"${a.segment.text.slice(0, 100)}"`)
                    .join('; ')
                : ''
            return `- "${code.name}" (${code._count.codeAssignments}× used, ${code.type})${
                code.definition ? ` — ${(code.definition as string).slice(0, 100)}` : ''
            }${examples ? ` | e.g. ${examples}` : ''}`
        }).join('\n')

        // 4. Get project context and existing themes
        const [project, existingThemes] = await Promise.all([
            prisma.project.findUnique({
                where: { id: params.projectId },
                select: { name: true, description: true, researchQuestion: true }
            }),
            prisma.theme.findMany({
                where: { projectId: params.projectId, status: { not: 'MERGED' } },
                select: { name: true, description: true }
            })
        ])

        const existingThemesSummary = existingThemes.length > 0
            ? existingThemes.map((t: any) => `- "${t.name}"`).join('\n')
            : 'None yet.'

        const userInstructions = (customPrompt as string | undefined)?.trim() || ''

        const prompt = `You are a senior qualitative researcher grouping codes into themes (thematic analysis, Steps 3-4).

Project: "${project?.name || 'Research Project'}"
${project?.researchQuestion ? `Research Question: ${project.researchQuestion}` : ''}

EXISTING THEMES (do NOT recreate these; only reuse exact name if a code clearly belongs there):
${existingThemesSummary}

You are processing batch ${batchStart + 1}–${batchStart + batchCodes.length} of ${allUnassigned.length} total unassigned codes:
${codesSummary}
${remainingAfterBatch > 0 ? `\nNOTE: There are ${remainingAfterBatch} more codes in subsequent batches. Focus on grouping AS MANY of the above codes as possible.` : ''}

RULES:
1. Group the codes above into 3–15 themes. MAXIMIZE coverage — try to place every code into a theme.
2. Theme name = a plain-English sentence stating the finding directly (e.g. "Users distrust AI because it feels opaque"). No jargon words like "Dynamics", "Patterns", "Collaboration".
3. Each code may appear in at most ONE theme.
4. Minimum 2 codes per theme. No upper limit on codes per theme.
5. If a code clearly belongs to an existing theme listed above, use that EXACT theme name.
${Array.isArray(rejectedNames) && rejectedNames.length > 0 ? `6. REJECTED by user — DO NOT use or recreate: ${(rejectedNames as string[]).map((n: string) => `"${n}"`).join(', ')}` : ''}
${userInstructions ? `${Array.isArray(rejectedNames) && rejectedNames.length > 0 ? '7' : '6'}. EXTRA INSTRUCTIONS: ${userInstructions}` : ''}

Return ONLY a JSON array (no markdown, no explanation):
[
  {
    "name": "Theme name sentence",
    "description": "2-3 sentences: what exactly is this theme about?",
    "reason": "Why are these codes grouped together? What pattern is revealed?",
    "confidenceScore": 80,
    "codeNames": ["Exact code name from the list above", "Another exact code name"]
  }
]`

        // 5. Call AI
        if (!openai) {
            return NextResponse.json({
                suggestions: generateFallbackSuggestions(batchCodes),
                source: 'heuristic',
                totalUnassigned: allUnassigned.length,
                batchOffset: batchStart,
                remainingAfterBatch
            })
        }

        const response = await openai.chat.completions.create({
            // Use gpt-4o for larger batches to handle complexity; mini for small ones
            model: batchCodes.length > 60 ? 'gpt-4o' : 'gpt-4o-mini',
            temperature: 0.3,
            messages: [{ role: 'user', content: prompt }],
        })

        const raw = response.choices[0]?.message?.content ?? '[]'
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

        try {
            const suggestions = JSON.parse(cleaned)

            // Map code names back to IDs using the batch codes
            const enriched = suggestions.map((s: any) => ({
                ...s,
                reason: s.reason || null,
                confidenceScore: typeof s.confidenceScore === 'number' ? s.confidenceScore : null,
                connections: s.connections || null,
                codes: (s.codeNames || []).map((name: string) => {
                    const cleanName = name.trim().toLowerCase()
                    // 1. Exact match
                    let entry = batchCodes.find((c: any) => c.name.toLowerCase() === cleanName)
                    // 2. Partial match fallback
                    if (!entry) {
                        entry = batchCodes.find((c: any) =>
                            c.name.toLowerCase().includes(cleanName) ||
                            cleanName.includes(c.name.toLowerCase())
                        )
                    }
                    return entry
                        ? { id: entry.id, name: entry.name, instances: entry._count.codeAssignments, type: entry.type }
                        : null
                }).filter(Boolean)
            })).filter((s: any) => s.codes?.length >= 2)

            return NextResponse.json({
                suggestions: enriched,
                source: 'ai',
                totalUnassigned: allUnassigned.length,
                batchOffset: batchStart,
                batchSize: batchCodes.length,
                remainingAfterBatch
            })
        } catch (parseErr) {
            console.error('Failed to parse AI suggestions:', parseErr, '\nRaw:', raw.slice(0, 500))
            return NextResponse.json({
                suggestions: generateFallbackSuggestions(batchCodes),
                source: 'heuristic',
                totalUnassigned: allUnassigned.length,
                batchOffset: batchStart,
                remainingAfterBatch
            })
        }

    } catch (e) {
        console.error('Theme suggestion error:', e)
        return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
    }
}

// Simple heuristic-based fallback when no AI is available
function generateFallbackSuggestions(codes: any[]) {
    const suggestions: any[] = []
    const used = new Set<string>()

    for (let i = 0; i < codes.length; i++) {
        if (used.has(codes[i].id)) continue
        const group = [codes[i]]
        const words1 = new Set(codes[i].name.toLowerCase().split(/\s+/))

        for (let j = i + 1; j < codes.length; j++) {
            if (used.has(codes[j].id)) continue
            const words2 = new Set(codes[j].name.toLowerCase().split(/\s+/))
            const overlap = Array.from(words1).filter(w => words2.has(w as string) && (w as string).length > 3).length
            const def1 = (codes[i].definition || '').toLowerCase()
            const def2 = (codes[j].definition || '').toLowerCase()
            const defOverlap = def1 && def2 &&
                def1.split(/\s+/).filter((w: string) => def2.includes(w) && w.length > 4).length > 2
            if (overlap > 0 || defOverlap) group.push(codes[j])
        }

        if (group.length >= 2) {
            group.forEach(g => used.add(g.id))
            suggestions.push({
                name: `Theme: ${group[0].name.split(' ')[0]}`,
                tags: ['Auto-grouped'],
                description: `These ${group.length} codes share semantic similarities and may form a coherent theme.`,
                codes: group.map((g: any) => ({
                    id: g.id,
                    name: g.name,
                    instances: g._count.codeAssignments,
                    type: g.type
                }))
            })
        }
    }
    return suggestions
}
