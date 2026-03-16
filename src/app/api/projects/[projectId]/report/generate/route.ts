import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { openai } from '@/lib/ai'

// POST /api/projects/[projectId]/report/generate — AI generates a draft for one section
export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const body = await req.json()
        const { type, themeId, customPrompt } = body
        // type = THEMATIC_SUMMARY | FINDING | RECOMMENDATION

        // 1. Get project context
        const project = await prisma.project.findUnique({
            where: { id: params.projectId },
            select: { name: true, description: true, researchQuestion: true }
        })

        // 2. Get all themes with codes and quotes
        const themes = await prisma.theme.findMany({
            where: { projectId: params.projectId },
            include: {
                codeLinks: {
                    include: {
                        codebookEntry: {
                            select: {
                                id: true,
                                name: true,
                                definition: true,
                                type: true,
                                codeAssignments: {
                                    include: {
                                        segment: {
                                            select: {
                                                text: true,
                                                transcript: { select: { title: true } }
                                            }
                                        }
                                    },
                                    take: 5
                                }
                            }
                        }
                    }
                }
            }
        })

        if (themes.length === 0) {
            return NextResponse.json({ error: 'No themes found. Create themes first.' }, { status: 400 })
        }

        // 3. Build grounded context based on type
        let prompt = ''
        let title = ''

        if (type === 'THEMATIC_SUMMARY' && themeId) {
            const theme = themes.find(t => t.id === themeId)
            if (!theme) return NextResponse.json({ error: 'Theme not found' }, { status: 404 })

            title = theme.name

            const codesContext = theme.codeLinks.map(link => {
                const code = link.codebookEntry
                const quotes = code.codeAssignments.map((a, i) =>
                    `  [Q${i + 1}] "${a.segment.text.slice(0, 200)}" — (${a.segment.transcript.title})`
                ).join('\n')
                return `Code: "${code.name}" (${code.type})${code.definition ? `\n  Definition: ${code.definition}` : ''}\n  Evidence:\n${quotes || '  (no quotes)'}`
            }).join('\n\n')

            const userRules = customPrompt && customPrompt.trim().length > 0 
                ? `\nUSER-DEFINED RULES:\n${customPrompt}` 
                : `\nRULES:
- Write 2-4 paragraphs that synthesize the codes and quotes into a coherent narrative
- Every claim MUST be grounded in the evidence above — cite using [Q1], [Q2] etc.
- Do NOT invent any quotes or data points not present above  
- Use academic qualitative research register
- Start with a topic sentence that captures the theme's essence
- End with a brief interpretive comment on what this theme reveals`

            prompt = `You are a senior qualitative researcher writing a thematic summary.

Project: ${project?.name || 'Research Project'}
${project?.researchQuestion ? `Research Question: ${project.researchQuestion}` : ''}

Write a thematic summary for the theme "${theme.name}".
${theme.description ? `Theme description: ${theme.description}` : ''}

The following codes and verbatim quotes belong to this theme:

${codesContext}
${userRules}

Return ONLY the text content, no markdown headers.`

        } else if (type === 'FINDING') {
            title = 'Findings & Interpretation'

            const themeSummaries = themes.map(t => {
                const codes = t.codeLinks.map(l => l.codebookEntry.name).join(', ')
                return `- "${t.name}" (${t.codeLinks.length} codes: ${codes})`
            }).join('\n')

            const userRulesF = customPrompt && customPrompt.trim().length > 0
                ? `\nUSER-DEFINED RULES:\n${customPrompt}`
                : `\nWrite 2-4 paragraphs that:
1. Identify the overarching narrative that connects these themes
2. Highlight notable relationships (contradictions, reinforcements, or tensions between themes)
3. Discuss how these findings address the research question
4. Situate the findings within the broader context

RULES:
- Ground every interpretation in the named themes above
- Do NOT hallucinate codes, quotes, or themes not listed above
- Use academic qualitative research register
- Be interpretive but evidence-grounded`

            prompt = `You are a senior qualitative researcher writing the "Findings & Interpretation" section.

Project: ${project?.name || 'Research Project'}
${project?.researchQuestion ? `Research Question: ${project.researchQuestion}` : ''}

The following themes have been identified:

${themeSummaries}
${userRulesF}

Return ONLY the text content, no markdown headers.`

        } else if (type === 'RECOMMENDATION') {
            title = 'Recommendations & Implications'

            const themeSummaries = themes.map(t => {
                const codes = t.codeLinks.map(l => l.codebookEntry.name).join(', ')
                return `- "${t.name}" (codes: ${codes})`
            }).join('\n')

            const userRulesR = customPrompt && customPrompt.trim().length > 0
                ? `\nUSER-DEFINED RULES:\n${customPrompt}`
                : `\nWrite practical recommendations and implications (3-6 bullet points) that:
1. Are directly derived from the themes and evidence above
2. Address different stakeholder groups where appropriate
3. Include both immediate actionable steps and longer-term considerations
4. Connect back to the research question

RULES:
- Each recommendation must be traceable to at least one theme
- Format as structured points with stakeholder labels (e.g. "For Policy:", "For Practice:")
- Be specific and actionable, not vague
- Use academic qualitative research register`

            prompt = `You are a senior qualitative researcher writing the "Recommendations & Implications" section.

Project: ${project?.name || 'Research Project'}
${project?.researchQuestion ? `Research Question: ${project.researchQuestion}` : ''}

Themes identified:
${themeSummaries}
${userRulesR}

Return ONLY the text content, no markdown headers.`

        } else {
            return NextResponse.json({ error: 'Invalid type. Use THEMATIC_SUMMARY, FINDING, or RECOMMENDATION' }, { status: 400 })
        }

        // 4. Call AI
        if (!openai) {
            // Fallback when no API key
            const fallbackContent = type === 'THEMATIC_SUMMARY'
                ? `This section summarizes the theme "${title}". Based on the ${themes.find(t => t.id === themeId)?.codeLinks.length || 0} codes assigned to this theme, participants described experiences related to ${title.toLowerCase()}. [AI generation requires OpenAI API key — this is a placeholder draft for you to edit manually.]`
                : type === 'FINDING'
                ? `The analysis revealed ${themes.length} themes: ${themes.map(t => `"${t.name}"`).join(', ')}. These themes together suggest patterns and relationships that address the research question. [AI generation requires OpenAI API key — this is a placeholder draft for you to edit manually.]`
                : `Based on the findings, the following recommendations are proposed:\n\n${themes.map(t => `• For stakeholders concerned with "${t.name}": Consider addressing the underlying patterns identified through the ${t.codeLinks.length} associated codes.`).join('\n\n')}\n\n[AI generation requires OpenAI API key — this is a placeholder draft for you to edit manually.]`

            return NextResponse.json({ title, content: fallbackContent, source: 'fallback' })
        }

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.5,
            messages: [{ role: 'user', content: prompt }],
        })

        const content = response.choices[0]?.message?.content ?? ''

        // 5. Audit log
        await prisma.auditLog.create({
            data: {
                projectId: params.projectId,
                eventType: 'REPORT_AI_DRAFT',
                entityType: 'ReportSection',
                entityId: themeId || 'cross-theme',
                newValue: JSON.stringify({ type, title, contentLength: content.length }),
            }
        })

        return NextResponse.json({ title, content, source: 'ai' })
    } catch (e) {
        console.error('Report AI generation error:', e)
        return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 })
    }
}
