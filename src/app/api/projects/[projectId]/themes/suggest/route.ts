export const maxDuration = 60; // Max allowed for Vercel Hobby
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

        // 2. Filter out orphans (0 instances) and keep only unassigned codes (not yet linked to any theme)
        const unassignedCodes = codebookEntries.filter(c => 
            c._count.codeAssignments > 0 && c.themeLinks.length === 0
        )
        
        if (unassignedCodes.length < 2) {
            return NextResponse.json({ 
                suggestions: [], 
                message: 'Need at least 2 unassigned codes to generate theme suggestions' 
            })
        }

        // 3. Build context for AI
        const codesSummary = unassignedCodes.map(code => {
            const examples = code.codeAssignments
                .map(a => `"${a.segment.text.slice(0, 120)}"`)
                .join('\n    ')
            return `- "${code.name}" (${code._count.codeAssignments} instances, type: ${code.type})${code.definition ? `\n  Definition: ${code.definition}` : ''}${examples ? `\n  Example quotes:\n    ${examples}` : ''}`
        }).join('\n')

        // 4. Get project research context and existing themes
        const project = await prisma.project.findUnique({
            where: { id: params.projectId },
            select: { name: true, description: true, researchQuestion: true }
        })

        const existingThemes = await prisma.theme.findMany({
            where: { projectId: params.projectId, status: { not: 'MERGED' } },
            select: { name: true, description: true }
        })

        const existingThemesSummary = existingThemes.map(t => `- "${t.name}": ${t.description || 'No description'}`).join('\n')

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

[EXISTING THEMES IN THIS PROJECT]
${existingThemes.length > 0 ? existingThemesSummary : 'No themes currently exist.'}

[TASK — STEPS 3-4: CREATING CATEGORIES/THEMES]
1. Read through ALL unassigned codes carefully.
2. Group related codes into CATEGORIES (themes). 
3. **CRITICAL INSTRUCTION**: Whenever possible, place codes into an EXISTING THEME if they conceptually belong there. If you do this, you MUST use the EXACT spelling of the existing theme name.
4. If codes represent a completely new phenomenon that does not fit any existing theme, create a NEW theme name for them.
5. Create a HIERARCHY: each Category has sub-categories (the codes that belong to it).
6. Look for CONNECTIONS between categories.

${userInstructions ? `[USER'S ADDITIONAL INSTRUCTIONS]\n${userInstructions}\n` : ''}
GUIDELINES:
- Work at a more GENERAL, ABSTRACT level than the individual codes
- Only create new themes if existing ones won't work.
- A good theme tells a "story" with a clear central concept
- Each code should appear in at most ONE theme
- Aim for 3-7 main groupings
- Each grouping should have 2-5 sub-categories (codes)

[OUTPUT FORMAT]
Return a JSON array:
[
  {
    "name": "Category/Theme Name (abstract, conceptual)",
    "description": "A crystal clear, straightforward 2-3 sentence explanation of EXACTLY what this theme is about. Avoid vague academic jargon. What is the specific phenomenon, experience, or pattern happening here?",
    "reason": "Detailed analytical reasoning: What pattern did you observe? Why is this grouping meaningful? What does it reveal about the participants' experiences?",
    "confidenceScore": 85,
    "connections": "How does this theme connect to or influence other themes? What is its role in the bigger picture?",
    "codeNames": ["MUST exactly match the Code names provided above", "Another exact Code Name"]
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
            model: 'gpt-4o-mini',
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
                codes: (s.codeNames || []).map((name: string) => {
                    const cleanName = name.trim().toLowerCase();
                    // 1. Exact match attempt
                    let entry = unassignedCodes.find(c => c.name.toLowerCase() === cleanName);
                    // 2. Fuzzy match fallback
                    if (!entry) {
                        entry = unassignedCodes.find(c => c.name.toLowerCase().includes(cleanName) || cleanName.includes(c.name.toLowerCase()));
                    }
                    return entry ? { id: entry.id, name: entry.name, instances: entry._count.codeAssignments, type: entry.type } : null;
                }).filter(Boolean)
            })).filter((s: any) => s.codes && s.codes.length > 0);

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
