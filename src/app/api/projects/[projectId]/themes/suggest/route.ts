import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { openai } from '@/lib/ai'

// POST /api/projects/[projectId]/themes/suggest — AI suggests theme groupings
export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const body = await req.json().catch(() => ({}))
        const { customPrompt } = body || {}
        // 1. Get all codebook entries for this project with their assignment counts and segment texts
        const codebookEntries = await prisma.codebookEntry.findMany({
            where: { projectId: params.projectId },
            include: {
                codeAssignments: {
                    include: {
                        segment: {
                            select: { text: true, transcriptId: true }
                        },
                        aiSuggestion: {
                            select: { uncertainty: true }
                        }
                    },
                    take: 5 // limit examples per code
                },
                _count: { select: { codeAssignments: true } },
                themeLinks: true
            }
        })

        if (codebookEntries.length === 0) {
            return NextResponse.json({ suggestions: [], message: 'No codes found in this project' })
        }

        // 2. Filter to only unassigned codes (not yet linked to any theme)
        const unassignedCodes = codebookEntries.filter(c => c.themeLinks.length === 0)
        
        if (unassignedCodes.length < 2) {
            return NextResponse.json({ 
                suggestions: [], 
                message: 'Need at least 2 unassigned codes to generate theme suggestions' 
            })
        }

        // ─── STRATEGY 1: Try to use pre-generated themes from Step 2 analysis ───
        // Check if AI suggestions already have theme data embedded (from the new prompt format)
        const allSegmentsWithThemes = await prisma.segment.findMany({
            where: {
                transcript: {
                    dataset: { projectId: params.projectId }
                }
            },
            include: {
                suggestions: {
                    select: { label: true, uncertainty: true }
                },
                codeAssignments: {
                    select: { codebookEntry: { select: { id: true, name: true } } }
                }
            }
        })

        // Extract theme info from suggestion uncertainty field (where we store scoring JSON that may contain theme)
        // Or from the direct theme field if stored separately
        const themeToCodesMap = new Map<string, Set<string>>()
        const unassignedCodeNames = new Set(unassignedCodes.map(c => c.name.toLowerCase()))

        for (const seg of allSegmentsWithThemes) {
            for (const suggestion of seg.suggestions) {
                // Try to extract theme from the scoring JSON stored in uncertainty
                let themeName: string | null = null
                if (suggestion.uncertainty) {
                    try {
                        const parsed = JSON.parse(suggestion.uncertainty)
                        if (parsed.theme) themeName = parsed.theme
                    } catch { /* not JSON or no theme field */ }
                }

                if (themeName && suggestion.label) {
                    // Check if this label corresponds to an unassigned code
                    const matchingCode = unassignedCodes.find(c => 
                        c.name.toLowerCase() === suggestion.label.toLowerCase()
                    )
                    if (matchingCode) {
                        if (!themeToCodesMap.has(themeName)) {
                            themeToCodesMap.set(themeName, new Set())
                        }
                        themeToCodesMap.get(themeName)!.add(matchingCode.name)
                    }
                }
            }
        }

        // If we found pre-generated themes, use them directly (no AI call needed!)
        if (themeToCodesMap.size >= 2) {
            const preGenSuggestions = Array.from(themeToCodesMap.entries())
                .filter(([_, codeNames]) => codeNames.size >= 2)
                .map(([themeName, codeNames]) => {
                    const codes = Array.from(codeNames).map(name => {
                        const entry = unassignedCodes.find(c => c.name === name)
                        return entry ? { 
                            id: entry.id, 
                            name: entry.name, 
                            instances: entry._count.codeAssignments, 
                            type: entry.type 
                        } : null
                    }).filter(Boolean)

                    return {
                        name: themeName,
                        tags: ['Pre-generated'],
                        description: `Theme identified during initial AI coding (Step 2). Groups ${codes.length} related codes that were consistently categorized under this theme by the AI models.`,
                        reason: `These codes were independently assigned to the "${themeName}" theme by one or more AI models during transcript analysis, indicating a strong thematic pattern.`,
                        confidenceScore: 85,
                        connections: null,
                        codes,
                        codeNames: Array.from(codeNames)
                    }
                })

            if (preGenSuggestions.length >= 2) {
                return NextResponse.json({ suggestions: preGenSuggestions, source: 'pre-generated' })
            }
        }

        // ─── STRATEGY 2: Fallback to AI call if no pre-generated themes ───
        // 3. Build context for AI
        const codesSummary = unassignedCodes.map(code => {
            const examples = code.codeAssignments
                .map(a => `"${a.segment.text.slice(0, 120)}"`)
                .join('\n    ')
            return `- "${code.name}" (${code._count.codeAssignments} instances, type: ${code.type})${code.definition ? `\n  Definition: ${code.definition}` : ''}${examples ? `\n  Example quotes:\n    ${examples}` : ''}`
        }).join('\n')

        // 4. Get project research context
        const project = await prisma.project.findUnique({
            where: { id: params.projectId },
            select: { name: true, description: true, researchQuestion: true }
        })

        const userInstructions = customPrompt && customPrompt.trim().length > 0 ? customPrompt : ''

        const prompt = `[ROLE]
You are a senior qualitative researcher performing Steps 3-4 of thematic analysis: creating categories (themes) by grouping initial codes together.

[PROJECT CONTEXT]
Project: ${project?.name || 'Research Project'}
${project?.description ? `Description: ${project.description}` : ''}
${project?.researchQuestion ? `Research Question: ${project.researchQuestion}` : ''}

[INITIAL CODES FROM STEP 2]
These are the codes created during initial coding. Review them carefully:
${codesSummary}

[TASK — STEPS 3-4: CREATING CATEGORIES/THEMES]
1. Read through ALL codes carefully.
2. Group related codes into CATEGORIES (themes). You can:
   - Combine codes that describe the same phenomenon at different levels
   - Merge overlapping codes into a single, more abstract concept
   - Drop codes that are not meaningful enough to keep
3. Create a HIERARCHY: each Category has sub-categories (the codes that belong to it).
4. Categories do NOT have to be the same type — they can be about:
   - Processes or strategies the participants describe
   - Emotional experiences or psychological states
   - Actions and behaviors
   - Beliefs, values, or opinions
   - Relationships and social dynamics
   - Changes, transitions, or turning points
5. Look for CONNECTIONS between categories — how do they influence each other?
6. Decide if there is a HIERARCHY among the categories

${userInstructions ? `[USER'S ADDITIONAL INSTRUCTIONS]\n${userInstructions}\n` : ''}
GUIDELINES:
- Work at a more GENERAL, ABSTRACT level than the individual codes
- Be creative and open-minded — you are conceptualizing the data
- A good theme tells a "story" with a clear central concept
- Each code should appear in at most ONE theme
- Aim for 3-7 main themes
- Each theme should have 2-5 sub-categories (codes)

[OUTPUT FORMAT]
Return a JSON array:
[
  {
    "name": "Category/Theme Name (abstract, conceptual)",
    "tags": ["Emotional Tag", "Conceptual Tag"],
    "description": "What this category captures — the central concept or pattern. Why these codes belong together.",
    "reason": "Detailed analytical reasoning: What pattern did you observe? Why is this grouping meaningful? What does it reveal about the participants' experiences?",
    "confidenceScore": 85,
    "connections": "How does this theme connect to or influence other themes? What is its role in the bigger picture?",
    "codeNames": ["Code Name 1", "Code Name 2", "Code Name 3"]
  }
]
Return ONLY the JSON array. No markdown wrappers.`

        // 5. Call AI
        if (!openai) {
            // Fallback: simple grouping by name similarity
            return NextResponse.json({
                suggestions: generateFallbackSuggestions(unassignedCodes),
                source: 'heuristic'
            })
        }

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.4,
            messages: [{ role: 'user', content: prompt }],
        })

        const raw = response.choices[0]?.message?.content ?? '[]'
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

        try {
            const suggestions = JSON.parse(cleaned)
            
            // Map code names back to IDs
            const enriched = suggestions.map((s: any) => ({
                ...s,
                reason: s.reason || null,
                confidenceScore: typeof s.confidenceScore === 'number' ? s.confidenceScore : null,
                connections: s.connections || null,
                codes: s.codeNames?.map((name: string) => {
                    const entry = unassignedCodes.find(c => 
                        c.name.toLowerCase() === name.toLowerCase()
                    )
                    return entry ? { id: entry.id, name: entry.name, instances: entry._count.codeAssignments, type: entry.type } : null
                }).filter(Boolean) || []
            }))

            return NextResponse.json({ suggestions: enriched, source: 'ai' })
        } catch (parseErr) {
            console.error('Failed to parse AI suggestions:', parseErr)
            return NextResponse.json({
                suggestions: generateFallbackSuggestions(unassignedCodes),
                source: 'heuristic'
            })
        }

    } catch (e) {
        console.error('Theme suggestion error:', e)
        return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
    }
}

// Simple heuristic-based fallback when no AI is available
function generateFallbackSuggestions(codes: any[]) {
    // Group codes by simple keyword overlap
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
            
            // Also check definition similarity
            const def1 = (codes[i].definition || '').toLowerCase()
            const def2 = (codes[j].definition || '').toLowerCase()
            const defOverlap = def1 && def2 && 
                def1.split(/\s+/).filter((w: string) => def2.includes(w) && w.length > 4).length > 2

            if (overlap > 0 || defOverlap) {
                group.push(codes[j])
            }
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
