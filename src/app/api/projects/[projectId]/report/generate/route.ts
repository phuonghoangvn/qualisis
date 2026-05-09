import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function cleanQuote(text: string): string {
    return text
        .replace(/(?:\d{2}:)?\d{2}:\d{2}\s*Speaker\s*\d+\s*/gi, '')
        .replace(/Speaker\s*\d+\s*(?:\d{2}:)?\d{2}:\d{2}\s*/gi, '')
        .replace(/(?:\d{2}:)?\d{2}:\d{2}\s*/g, '')
        .replace(/Speaker\s*\d+\s*/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
}

export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        // 1. Fetch project info
        const project = await prisma.project.findUnique({
            where: { id: params.projectId },
            select: { name: true, description: true, researchQuestion: true, coreOntology: true }
        })
        if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

        // 2. Fetch themes with codes + quotes
        const rawThemes = await prisma.theme.findMany({
            where: { projectId: params.projectId, status: { not: 'MERGED' } },
            include: {
                relationsOut: { where: { relationType: 'SUBTHEME_OF' } },
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

        // 3. Build compact codebook evidence block for the prompt
        const codebookEvidence = rawThemes.map(theme => {
            const codes = theme.codeLinks.map(link => {
                const quotes = link.codebookEntry.codeAssignments
                    .filter(a => a.segment?.text)
                    .map(a => `    → "${cleanQuote(a.segment!.text)}" [${a.segment?.transcript?.title || 'Participant'}]`)
                    .join('\n')
                return `  • ${link.codebookEntry.name} (n=${link.codebookEntry._count.codeAssignments}): ${link.codebookEntry.definition || ''}\n${quotes}`
            }).join('\n\n')

            return `**Theme: ${theme.name}**\n${theme.description ? `Summary: ${theme.description}\n` : ''}Codes:\n${codes}`
        }).join('\n\n---\n\n')

        const researchQuestion = project.researchQuestion || '(not specified)'
        const fieldContext = project.coreOntology || project.description || '(qualitative research)'
        const now = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })

        // 4. PHASE 1 — Synthesize what the literature already says
        const literatureSynthesisPrompt = `You are an expert academic researcher with deep knowledge of the most current peer-reviewed literature (up to 2024-2025).

The researcher is studying this research question:
"${researchQuestion}"

Field/Context: ${fieldContext}

YOUR TASK — LITERATURE SYNTHESIS:
Write a structured synthesis of what the MOST RECENT peer-reviewed academic literature (prioritise 2022–2025) already knows about this topic.

For each major area the literature covers, write 2-3 sentences summarising the current scholarly consensus. Reference real, plausible author names, journals, and years (draw on your training knowledge of real papers in HCI, CSCW, qualitative methods, AI-assisted research, etc. as relevant).

Structure your synthesis as:
## What Existing Literature Already Knows

### [Sub-topic Area 1]
[2-3 sentences of synthesis with citations]

### [Sub-topic Area 2]
[2-3 sentences]

(continue for 4-6 sub-areas most relevant to the research question)

Be precise and academically rigorous. Do NOT fabricate findings; draw on real scholarly conversations.`

        const litCompletion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: literatureSynthesisPrompt }],
            temperature: 0.3,
            max_tokens: 1800,
        })
        const literatureSynthesis = litCompletion.choices[0]?.message?.content || ''

        // 5. PHASE 2 — Gap analysis comparing literature with codebook data
        const gapAnalysisPrompt = `You are an expert qualitative researcher writing a "Research Gap Analysis" section for a peer-reviewed academic paper.

RESEARCH QUESTION (anchor everything here):
"${researchQuestion}"

WHAT THE LITERATURE ALREADY SAYS (synthesised from peer-reviewed sources):
${literatureSynthesis}

WHAT THE RESEARCHER'S DATA SHOWS (codebook from empirical fieldwork):
${codebookEvidence}

---

YOUR TASK — WRITE A GAP ANALYSIS REPORT:

Write a full academic gap analysis that:
1. Identifies 4-6 specific, concrete gaps between what existing literature covers and what the empirical data shows
2. Frames each gap as: "Existing work tends to focus on X, but this data reveals Y — which has not been adequately theorised"
3. Anchors every gap directly to the research question
4. Uses specific verbatim participant quotes from the codebook data as evidence (clean the quotes — remove any timestamps or "Speaker X" markers before the quote text)
5. Produces writing that could go directly into a thesis Discussion section

Format:
# Gap Analysis: [Project Topic]

## Overview
[2-3 sentences: what the data reveals that the literature has missed, in relation to the research question]

## Gap 1: [Short compelling title]
**What the literature says:** ...
**What this data shows:** ...
**Why this matters:** ...
**Evidence from data:**
> "[participant quote]" — [Participant name]

## Gap 2: [Short compelling title]
...

(repeat for each gap)

## Theoretical Contribution
[3-4 sentences: how these gaps collectively point to a novel theoretical contribution or reframing]

## Implications for Future Research
[Bullet list of 3-5 concrete directions]

---
Rules:
- Do NOT invent participant quotes. Use ONLY quotes from the codebook data provided above.
- Do NOT just summarise the codebook. Identify genuine tensions between literature and data.
- Be analytically sharp. The best gaps show something the field has overlooked, misframed, or undertheorised.
- All gaps must directly serve the research question.`

        const gapCompletion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: gapAnalysisPrompt }],
            temperature: 0.35,
            max_tokens: 3500,
        })
        const gapAnalysis = gapCompletion.choices[0]?.message?.content || ''

        // 6. Build stats for report header
        const participantSet = new Set<string>()
        rawThemes.forEach(t => t.codeLinks.forEach(l =>
            l.codebookEntry.codeAssignments.forEach(a => {
                if (a.segment?.transcript?.title) participantSet.add(a.segment.transcript.title)
            })
        ))
        const totalCodesCount = rawThemes.reduce((acc, t) => acc + t.codeLinks.length, 0)

        // 7. Build codebook appendix table
        const appendixRows = rawThemes.flatMap(t =>
            t.codeLinks.map(l => {
                const codeDef = `**${l.codebookEntry.name}**<br>_${(l.codebookEntry.definition || 'No definition provided').replace(/\|/g, '/')}_`
                const sampleQuote = l.codebookEntry.codeAssignments.find(a => a.segment?.text)?.segment
                const quoteHtml = sampleQuote
                    ? `"${cleanQuote(sampleQuote.text).replace(/\|/g, '/')}"<br>— ${sampleQuote.transcript?.title || 'Participant'}`
                    : '—'
                return `| **${t.name}** | ${codeDef} | ${quoteHtml} |`
            })
        )

        // 8. Assemble full report
        const fullReport = `# Research Gap Analysis: ${project.name}

**Generated:** ${now}
**Analysis Method:** AI-Assisted Thematic Analysis & Literature Gap Mapping (QualiSIS)
**Participants:** ${participantSet.size}
**Themes:** ${rawThemes.length}
**Total Codes:** ${totalCodesCount}

---

## Research Question

${researchQuestion}

---

${literatureSynthesis}

---

${gapAnalysis}

---

## Appendix: Codebook Summary

| Theme | Code · Definition | Sample Excerpt |
|---|---|---|
${appendixRows.join('\n')}

---

*This report was generated with AI assistance using QualiSIS. Literature references draw on the model's training knowledge and should be verified before submission. All thematic interpretations should be reviewed and validated by the researcher.*`

        return NextResponse.json({ report: fullReport })

    } catch (e: any) {
        console.error('Report generation error:', e)
        return NextResponse.json({ error: e.message || 'Failed to generate report' }, { status: 500 })
    }
}
