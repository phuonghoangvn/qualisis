import sys

file_path = "/Users/Maria/Documents/QualiSIS/src/app/api/projects/[projectId]/chat/route.ts"
with open(file_path, "r") as f:
    content = f.read()

# Replace the relevanceScore function
relevance_func = """// Simple keyword relevance score between a query and a piece of text
function relevanceScore(query: string, text: string): number {
    const stopWords = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was', 'were', 'have', 'has', 'had', 'what', 'how', 'when', 'who', 'where', 'why', 'can', 'did', 'does', 'about'])
    const queryWords = query.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w))
    if (queryWords.length === 0) return 0
    const lowerText = text.toLowerCase()
    return queryWords.filter(w => lowerText.includes(w)).length / queryWords.length
}

"""
content = content.replace(relevance_func, "")

# Replace the logic block
start_marker = "        // ── LAYER 2: RAG-lite — Retrieve Relevant Coded Segments ───────────"
end_marker = "        // ── Call GPT-4o (not mini) for deeper reasoning ───────────────────"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Markers not found!")
    sys.exit(1)

new_logic = """        // ── LAYER 2: Full Transcript Data (For Prompt Caching) ───────────
        // Fetch ALL raw transcripts for this project to leverage Prompt Caching.
        const allTranscripts = await prisma.transcript.findMany({
            where: { dataset: { projectId } },
            select: { id: true, title: true, text: true, status: true }
        })

        const transcriptsContext = allTranscripts.length > 0
            ? allTranscripts.map(t => `--- BEGIN TRANSCRIPT: "${t.title}" ---\\n${t.text}\\n--- END TRANSCRIPT: "${t.title}" ---`).join('\\n\\n')
            : 'No transcripts available.'

        // ── LAYER 3: Build Rich System Prompt ─────────────────────────────
        const codebookContext = codebook.length > 0
            ? codebook.map(c => `  - ${c.name} (${c.type}): ${c.definition || 'No definition'}`).join('\\n')
            : '  No codes created yet.'

        const themesContext = themes.length > 0
            ? themes.map((t: any) => `  - ${t.name}: ${t.description || 'No description'}`).join('\\n')
            : '  No themes created yet.'

        const systemPrompt = `You are an expert qualitative research analyst embedded in QualiSIS, a thematic analysis platform.

You are assisting the researcher working on the project: "${project.name}"
${project.description ? `Project Description: ${project.description}` : ''}
${(project as any).researchQuestion ? `Research Question: ${(project as any).researchQuestion}` : ''}

━━━ LAYER 1: PROJECT KNOWLEDGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CODEBOOK (${codebook.length} codes):
${codebookContext}

THEMES (${themes.length} themes):
${themesContext}

━━━ LAYER 2: FULL RAW DATA (PROMPT CACHING ENABLED) ━━━━━━━━
Below are the complete, raw transcripts for this project.
Because you have access to the full text, you must perform exhaustive semantic reading across ALL provided transcripts to answer the researcher's questions. Do not miss any relevant details, even if they have not been formally coded yet.

${transcriptsContext}

━━━ YOUR ROLE & INSTRUCTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are NOT a generic chatbot. You are a qualitative research analyst who:

1. GROUNDS answers in actual data: Always cite specific quotes from the raw transcripts when discussing patterns. Format citations as: *"[quote]"* — [Transcript Title]
2. REASONS analytically: Synthesize, compare across participants, identify contradictions, and offer interpretive insights.
3. SUPPORTS methodology: Help with Braun & Clarke's RTA phases, reflexivity, codebook refinement, theme naming, and narrative writing.
4. THINKS across transcripts: Look for patterns that appear in multiple transcripts.

When the researcher asks a question:
- Exhaustively scan the FULL transcripts provided above.
- Identify relevant quotes and patterns, regardless of whether they are in the codebook.
- Synthesize what multiple participants say.
- Note agreements, tensions, and contradictions.
- Always be academically rigorous, empathetic to participants, and reflexively aware of interpretation.`

"""

content = content[:start_idx] + new_logic + content[end_idx:]

# Update the meta response
old_meta = """            meta: {
                segmentsRetrieved: contextSegments.length,
                totalCodedSegments: totalCoded,
                relevantByKeyword: scoredSegments.length
            }"""
new_meta = """            meta: {
                transcriptsAnalyzed: allTranscripts.length,
                promptCaching: "Enabled via Context Prefix"
            }"""
content = content.replace(old_meta, new_meta)

with open(file_path, "w") as f:
    f.write(content)
print("Updated successfully")
