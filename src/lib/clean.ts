import { prisma } from '@/lib/prisma'
import { openai, anthropic, gemini } from '@/lib/ai'

export async function autoCleanHighlights(transcriptId: string) {
    try {
        const transcript = await prisma.transcript.findUnique({
            where: { id: transcriptId },
            include: {
                segments: {
                    include: { suggestions: true }
                },
                dataset: {
                    include: { project: true }
                }
            }
        });

        if (!transcript) return 0;

        const project = transcript.dataset.project;
        const researchContext = project.researchQuestion || project.coreOntology 
            ? `Research Question: ${project.researchQuestion || 'Not specified'}\nCore Ontology: ${project.coreOntology || 'Not specified'}` 
            : 'General qualitative research exploratory analysis (No specific question provided, focus on major experiences and behavioral patterns).';

        const relevanceRule = project.researchQuestion || project.coreOntology 
            ? "2. Moderate or Low Relevance: If it doesn't directly and profoundly answer the Research Question, DROP it."
            : "2. Moderate or Low Relevance: If it lacks profound, insightful meaning for a deep psychological or sociological study, DROP it.";

        const CLEAN_PROMPT = `
[ROLE]
You are a senior Qualitative Researcher performing a HOLISTIC REREAD (Second Pass Analysis).
Earlier, an AI performed a raw line-by-line coding, generating the draft codes below.

[HOLISTIC CONTEXT (Full Transcript Story)]
Below is the FULL text of the interview. Read it carefully to understand the complete narrative, tone, and the TRUE overarching issues described by the participant, rather than judging fragmented sentences in isolation.
--- TRANSCRIPT START ---
${transcript.content}
--- TRANSCRIPT END ---

Project Context:
${researchContext}

[YOUR TASK: REFINEMENT & FILTERING]
Based on your understanding of the FULL transcript narrative above, review the provided list of Draft Codes.
Your goal is to cure "Code Explosion" (over-coding).
Drop a draft code if:
1. It focuses on a trivial, isolated detail that does not matter to the participant's overall narrative.
2. It is a duplicate or near-duplicate of a stronger code (drop the weaker one).
3. It takes a sarcastic or off-hand comment literally due to lack of previous context.
4. It does not meaningfully contribute to answering the Research Question.

Keep a draft code ONLY if:
1. It captures a recurring motif, a profound emotion, or a pivotal event in the participant's story.
2. It represents a significant, undeniable qualitative core insight.

Be ruthless but accurate. For each code, output if it should be kept or dropped.

JSON FORMAT:
{
  "decisions": [
    { "id": "code_id", "action": "KEEP" | "DROP", "reason": "brief reason if dropped" }
  ]
}

CODES TO ANALYZE:
`;

        // Group suggestions by model
        const suggestionsByModel: Record<string, any[]> = {
            gpt: [],
            claude: [],
            gemini: []
        };

        for (const seg of transcript.segments) {
            for (const sug of seg.suggestions) {
                if (sug.status === 'SUGGESTED' || sug.status === 'UNDER_REVIEW') {
                    const modelKey = (sug.modelProvider || 'gpt').toLowerCase();
                    const validKey = ['gpt', 'claude', 'gemini'].includes(modelKey) ? modelKey : 'gpt';
                    suggestionsByModel[validKey].push({
                        id: sug.id,
                        label: sug.label,
                        text: seg.text.substring(0, 200) + (seg.text.length > 200 ? '...' : '')
                    });
                }
            }
        }

        let allDropIds: string[] = [];

        // 1. Process GPT codes
        if (suggestionsByModel.gpt.length > 0 && openai) {
            const promptText = CLEAN_PROMPT + JSON.stringify(suggestionsByModel.gpt, null, 2);
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [{ role: "user", content: promptText }],
                    response_format: { type: "json_object" },
                    temperature: 0.1
                });
                const resultJson = JSON.parse(completion.choices[0].message.content || '{"decisions":[]}');
                const dropIds = (resultJson.decisions || []).filter((d: any) => d.action === 'DROP').map((d: any) => d.id);
                allDropIds.push(...dropIds);
            } catch (e) {}
        }

        // 2. Process Claude codes
        if (suggestionsByModel.claude.length > 0 && anthropic) {
            const promptText = CLEAN_PROMPT + JSON.stringify(suggestionsByModel.claude, null, 2);
            try {
                const response = await anthropic.messages.create({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 4000,
                    system: "You are an expert qualitative researcher. Return ONLY valid JSON matching the requested format.",
                    messages: [{ role: 'user', content: promptText }],
                    temperature: 0.1
                });
                const content = 'text' in response.content[0] ? response.content[0].text : '{}';
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                const jsonStr = jsonMatch ? jsonMatch[0] : content;
                
                const resultJson = JSON.parse(jsonStr);
                const dropIds = (resultJson.decisions || []).filter((d: any) => d.action === 'DROP').map((d: any) => d.id);
                allDropIds.push(...dropIds);
            } catch (e) {}
        }

        // 3. Process Gemini codes
        if (suggestionsByModel.gemini.length > 0 && gemini) {
            const promptText = CLEAN_PROMPT + JSON.stringify(suggestionsByModel.gemini, null, 2);
            try {
                const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash', generationConfig: { responseMimeType: 'application/json' } });
                const result = await model.generateContent(promptText);
                const responseText = result.response.text();
                const resultJson = JSON.parse(responseText || '{"decisions":[]}');
                const dropIds = (resultJson.decisions || []).filter((d: any) => d.action === 'DROP').map((d: any) => d.id);
                allDropIds.push(...dropIds);
            } catch (e) {}
        }

        if (allDropIds.length > 0) {
            // Delete dropped suggestions completely
            await prisma.aISuggestion.deleteMany({
                 where: { id: { in: allDropIds } }
            });
            // Cleanup empty segments
            const emptySegments = await prisma.segment.findMany({
                 where: { transcriptId: transcript.id, suggestions: { none: {} }, codeAssignments: { none: {} } },
                 select: { id: true }
            });
            if (emptySegments.length > 0) {
                 const emptyIds = emptySegments.map(s => s.id);
                 await prisma.segment.deleteMany({
                     where: { id: { in: emptyIds } }
                 });
            }
        }

        return allDropIds.length;
    } catch (e: any) {
        console.error('Auto clean error:', e);
        return 0;
    }
}
