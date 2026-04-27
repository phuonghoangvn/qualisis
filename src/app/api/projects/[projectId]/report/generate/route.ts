import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        // 1. Fetch project info
        const project = await prisma.project.findUnique({
            where: { id: params.projectId },
            select: { name: true, description: true, researchQuestion: true }
        })
        if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

        // 2. Fetch themes with codes + up to 3 quotes per code
        const rawThemes = await prisma.theme.findMany({
            where: { projectId: params.projectId, status: { not: 'MERGED' } },
            include: {
                codeLinks: {
                    include: {
                        codebookEntry: {
                            select: {
                                name: true,
                                definition: true,
                                _count: { select: { codeAssignments: true } },
                                codeAssignments: {
                                    take: 3,
                                    select: {
                                        segment: {
                                            select: {
                                                text: true,
                                                transcript: { select: { title: true } }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
            },
            orderBy: { createdAt: 'desc' }
        })

        // 3. Helper: format a single theme's codes into text
        const formatCodes = (theme: typeof rawThemes[0]) => {
            if (theme.codeLinks.length === 0) return '  (no codes assigned yet)'
            return theme.codeLinks.map(link => {
                const quotes = link.codebookEntry.codeAssignments
                    .filter(a => a.segment?.text)
                    .map(a => `      - "${a.segment!.text}" [${a.segment?.transcript?.title || 'Participant'}]`)
                    .join('\n')
                return `  • Code: ${link.codebookEntry.name} (${link.codebookEntry._count.codeAssignments} instances)\n    Definition: ${link.codebookEntry.definition || '(no definition)'}\n    Sample quotes:\n${quotes || '      (none)'}`
            }).join('\n\n')
        }

        // 4. Build flat theme summary for prompt
        const themesSummary = rawThemes.map(theme =>
            `## Theme: ${theme.name}\nDescription: ${theme.description || '(no description)'}\n\nCodes:\n${formatCodes(theme)}`
        ).join('\n\n---\n\n')

        const researchQuestions = project.researchQuestion || '(not specified)'

        const systemPrompt = `You are an expert qualitative researcher writing the "Thematic Findings" section of an academic research report. 
Write in a scholarly but accessible tone. Use first person plural ("we found", "the analysis revealed").
Always embed verbatim quotes from participants to evidence each point. 
Format output in clean Markdown with clear headings.`

        const userPrompt = `Write the full "Thematic Findings" section for this study.

PROJECT: ${project.name}
TOPIC: ${project.description || '(see project name)'}
RESEARCH QUESTION:
${researchQuestions}

CODEBOOK DATA:
${themesSummary}

---

Instructions:
1. Write an INTRODUCTION paragraph (2-3 sentences) framing the overall findings
2. For each theme, write a FULL narrative paragraph (100-200 words) that:
   - States what the theme represents and its significance
   - Weaves in 2-3 verbatim participant quotes as evidence (format: *"quote text"* [ParticipantName])
   - Explains how the codes within the theme relate to each other
   - Links back to the research question if relevant
3. Write a SYNTHESIS paragraph (3-4 sentences) identifying cross-cutting patterns across themes
4. Use this exact heading structure:
   - # Thematic Findings
   - ## 1. [Theme Name]
   - ## Synthesis and Cross-Cutting Patterns

Be specific, analytical, and evidence-based. Do NOT invent quotes — use only those provided above.`

        // 5. Call OpenAI
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 4000,
        })

        const reportMarkdown = completion.choices[0]?.message?.content || ''

        // 6. Build full report with metadata sections
        const now = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
        const participantSet = new Set<string>()
        rawThemes.forEach(t => t.codeLinks.forEach(l =>
            l.codebookEntry.codeAssignments.forEach(a => {
                if (a.segment?.transcript?.title) participantSet.add(a.segment.transcript.title)
            })
        ))

        const totalCodesCount = rawThemes.reduce((acc, t) => acc + t.codeLinks.length, 0)

        // Build flat appendix table
        const appendixRows = rawThemes.flatMap(t =>
            t.codeLinks.map(l => {
                const codeDef = `**${l.codebookEntry.name}**<br>_${(l.codebookEntry.definition || 'No definition provided').replace(/\|/g, '/')}_`
                const sampleQuote = l.codebookEntry.codeAssignments.find(a => a.segment?.text)?.segment
                const quoteHtml = sampleQuote ? `"${sampleQuote.text.replace(/\|/g, '/')}"<br>— ${sampleQuote.transcript?.title || 'Participant'}` : '—'
                return `| **${t.name}** | ${codeDef} | ${quoteHtml} |`
            })
        )

        const fullReport = `# Research Report: ${project.name}

**Generated:** ${now}  
**Analysis Method:** AI-Assisted Thematic Analysis (QualiSIS)  
**Participants:** ${participantSet.size}  
**Themes:** ${rawThemes.length}  
**Total Codes:** ${totalCodesCount}

---

## Research Questions

${researchQuestions}

---

${reportMarkdown}

---

## Appendix: Codebook Summary

| Theme | Code · Definition | Sample Excerpt |
|---|---|---|
${appendixRows.join('\n')}

---

*This report was generated with AI assistance using QualiSIS. All thematic interpretations should be reviewed and validated by the researcher.*`

        return NextResponse.json({ report: fullReport })

    } catch (e: any) {
        console.error('Report generation error:', e)
        return NextResponse.json({ error: e.message || 'Failed to generate report' }, { status: 500 })
    }
}
