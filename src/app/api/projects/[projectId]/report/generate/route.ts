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

        // 4. PHASE 0 — Data Detective: mine for tensions, surprises, contradictions BEFORE writing
        const detectivePrompt = `You are a sharp qualitative data analyst. Your job is NOT to summarise the data. Your job is to READ the raw quotes carefully and find what is analytically INTERESTING, SURPRISING, TENSE, or COUNTER-INTUITIVE.

RESEARCH QUESTION:
"${researchQuestion}"

RAW DATA (quotes from participants):
${codebookEvidence}

---

YOUR TASK — DATA DETECTIVE PASS:

Read every quote carefully. Then identify:

1. TENSIONS: Places where participants say or do things that are in conflict with each other, or that contradict what we would expect.
   Format: "TENSION: [describe it]. Evidence: '[quote A]' vs '[quote B]'"

2. SURPRISES: Things participants do or say that are unexpected — that push back against the common assumption in the literature.
   Format: "SURPRISE: [describe it]. Quote: '[quote]' ([participant])"

3. THINGS PARTICIPANTS DO BUT DON'T REALISE THEY'RE DOING: Practices, workarounds, or adaptations that are analytically significant but the participant describes casually.
   Format: "IMPLICIT PRACTICE: [describe it]. Quote: '[quote]' ([participant])"

4. SHARPER REFRAMINGS: A pattern that looks simple on the surface but reveals something more complex when read carefully.
   Format: "REFRAMING: Instead of reading this as 'X', this data suggests 'Y'. Evidence: '[quote]'"

5. KEY QUOTES: The 3–5 single sharpest quotes in the entire dataset — the ones that most precisely name something real and analytically valuable.
   Format: "SHARP QUOTE: '[exact quote]' ([participant]) — Why it matters: [1 sentence]"

Be ruthless. Only report genuine insights — things that are actually analytically interesting. Do NOT just summarise what participants said. Find what's SURPRISING, TENSE, or ANALYTICALLY RICH.`

        const detectiveCompletion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: detectivePrompt }],
            temperature: 0.4,
            max_tokens: 2000,
        })
        const dataInsights = detectiveCompletion.choices[0]?.message?.content || ''

        // 5. PHASE 1 — Synthesize what the literature already says
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

        // 5. PHASE 2 — Full thesis structure: Findings → Discussion → Design Guidelines
        const gapAnalysisPrompt = `You are an expert qualitative researcher writing a thesis. Your task is to produce three connected sections: Findings, Discussion, and Design Guidelines.

RESEARCH QUESTION (anchor everything here):
"${researchQuestion}"

WHAT THE LITERATURE ALREADY SAYS:
${literatureSynthesis}

RESEARCHER'S EMPIRICAL DATA (codebook from fieldwork):
${codebookEvidence}

ANALYTICAL DETECTIVE PASS (tensions, surprises, implicit practices, sharp quotes — mined from the raw data):
${dataInsights}

---

PART 0 — DERIVE THE CENTRAL ARGUMENT FIRST (do not output this section, use it to guide everything else):

Before writing, formulate ONE central argument sentence that:
- Names what the data shows
- Names what existing literature has missed or misframed
- Uses the language system: hybrid workflow, conditional reliance, traceability, interpretive alignment, analytic ownership, contextual refinement

This sentence is the spine. Every finding, every discussion paragraph, every design guideline must serve it.

---

PART 1 — FINDINGS

Rules for Findings:
- START FROM THE DETECTIVE PASS ABOVE. The tensions, surprises, implicit practices, and sharp quotes identified there are your analytical raw material. Build findings around those discoveries — not around theme names.
- Consolidate all themes/codes into EXACTLY 4–5 high-level findings. Do not list themes or codes separately.
- Each finding must name a PATTERN + its MEANING. A finding that just says "participants used AI" is worthless. A finding that says "participants systematically introduced AI only after establishing their own reading of the data, suggesting AI was used as a comparative lens rather than a primary analytic engine" is valuable.
- Write each finding using this three-layer structure:
  A. CLAIM: One sentence naming the finding as a sharp, specific pattern — not a theme label.
  B. EVIDENCE: 2–3 participant quotes embedded in prose (not block-quoted). Strip timestamps and "Speaker X" labels.
  C. INTERPRETATION: 2–3 sentences on what this pattern means for the research question. Name what it reveals that wasn't obvious.
- Prefer findings that capture tensions, contradictions, or counter-intuitive practices over findings that just confirm expectations.
- Use consistent language: hybrid workflow / conditional reliance / traceability / interpretive alignment / analytic ownership

---

# Findings

## Finding 1: [Short title — a descriptive claim]

**Claim:** [One sentence stating the finding as a pattern.]

**Evidence:** [2–3 sentences weaving in participant quotes as evidence. Embed quotes inline: as one participant noted, "..." ([Name]).

**Interpretation:** [2–3 sentences: what does this pattern mean for the research question?]

## Finding 2: [Short title]

**Claim:** ...
**Evidence:** ...
**Interpretation:** ...

## Finding 3: [Short title]
[Same structure]

## Finding 4: [Short title]
[Same structure]

## Finding 5: [Short title — only if clearly supported by a fifth distinct pattern in the data]
[Same structure]

---

PART 2 — DISCUSSION

Rules for Discussion:
- Do NOT repeat what Findings already said. Findings describe patterns. Discussion explains what those patterns mean conceptually.
- For each major finding, follow this formula:
  Finding says: Researchers do X.
  This means: This changes how we understand Y.
  Compared with literature: Existing work says A, but this data shows B, which suggests C.
- Use the central argument spine to connect findings into one coherent intellectual story.
- Use the language system consistently. Do not switch between "control", "agency", "ownership" if they mean the same thing. Use the defined terms:
  - trust = researcher believes output is meaningful and defensible
  - reliance = researcher uses AI for practical reasons, regardless of trust level
  - control = researcher can steer, edit, or reject AI outputs
  - ownership = researcher maintains interpretive authority and responsibility
- Show explicitly: reliance ≠ trust. This is the key conceptual move.
- End with a Conceptual Contribution paragraph that names something new — a concept, framework, or reframing.

---

# Discussion

## The Central Argument
[3–4 sentences. State the one core claim. Name what assumption in the literature it challenges. Use "This study argues that...", "Contrary to...", "The key issue is not X but Y."]

## What the Literature Has Framed — and Why It Falls Short
[4–6 sentences in ONE paragraph. Weave together 2–3 literature positions, name what each cannot see, and show how they collectively produce the blind spot this data addresses. Do not list them. Write as flowing prose.]

## Conceptual Move 1: [verb-noun reframing — e.g. "From AI Adoption to Negotiated Integration"]
[5–7 sentences. Open with the tension between literature and finding. Develop the finding analytically. Connect back to the central argument. 1–2 embedded participant quotes.]

## Conceptual Move 2: [verb-noun reframing]
[5–7 sentences. Same structure.]

## Conceptual Move 3: [verb-noun reframing]
[5–7 sentences. Same structure.]

## Conceptual Move 4: [Only if supported by a fourth distinct data cluster]
[5–7 sentences. Same structure.]

## Conceptual Contribution: Towards [Name of the new concept or framework]
[4–5 sentences. Name the contribution explicitly. A reframing of how the field should think. Connect back to the central argument. This is the thesis's original insight.]

---

PART 3 — DESIGN GUIDELINES

Rules for Design Guidelines:
- There should be EXACTLY one design guideline per major finding (4–5 guidelines total).
- Each guideline must be explicitly derived from its corresponding finding — not invented.
- Use this fixed format for every guideline:

**Guideline N: [Short title — imperative verb, e.g. "Support hybrid human-AI workflows"]**

*Why this matters (from the findings):* [1–2 sentences directly linking to the finding.]

*Design recommendation:* [1–2 sentences on what the tool/system should do.]

*Possible features:* [Bullet list of 2–4 specific, concrete feature examples.]

---

# Design Guidelines

**Guideline 1: [Title]**

*Why this matters:* ...
*Design recommendation:* ...
*Possible features:*
- ...
- ...

**Guideline 2: [Title]**
[Same structure]

**Guideline 3: [Title]**
[Same structure]

**Guideline 4: [Title]**
[Same structure]

**Guideline 5: [Title — only if there is a 5th finding]**
[Same structure]

---

APPENDIX TABLE: Mapping Overview

| Finding | Core Evidence | Discussion Concept | Design Guideline |
|---|---|---|---|
| [Finding 1 title] | [Key quote or code] | [Concept it advances] | [Guideline 1 title] |
| [Finding 2 title] | [Key quote or code] | [Concept it advances] | [Guideline 2 title] |
| [Finding 3 title] | [Key quote or code] | [Concept it advances] | [Guideline 3 title] |
| [Finding 4 title] | [Key quote or code] | [Concept it advances] | [Guideline 4 title] |

---

ABSOLUTE RULES:
1. Do NOT invent participant quotes. Use ONLY quotes from the codebook evidence provided.
2. Strip timestamps (e.g. "00:20:13") and "Speaker X" labels from all quotes.
3. Do NOT repeat in Discussion what Findings already said — Discussion adds conceptual meaning.
4. Do NOT write "Gap 1", "Gap 2", "Theme 1". Use the defined structure above.
5. Every Design Guideline must trace back to a specific Finding.
6. Use the language system consistently: hybrid workflow / conditional reliance / traceability / interpretive alignment / analytic ownership / contextual refinement.
7. The overall flow must tell a causal story: researchers try to stay close to data → AI becomes useful under pressure → they integrate it conditionally → trust requires traceability → ownership requires editability → therefore tools need to be hybrid, traceable, editable, and flexible.`

        const gapCompletion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: gapAnalysisPrompt }],
            temperature: 0.3,
            max_tokens: 5000,
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
