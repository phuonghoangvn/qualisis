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
You are a senior qualitative researcher overseeing the very final stage of coding. Your goal is to be EXTREMELY RUTHLESS in pruning the "Initial Codes" (AI suggestions). You must distill the highlights down to ONLY the most insightful, unique, and highly relevant findings. 

Context about the research study:
${researchContext}

You MUST DROP any code that meets ANY of the following criteria:
1. Duplicate/Overlapping: If two codes highlight the exact same or very similar point, DROP the weaker one.
${relevanceRule}
3. Trivial/Commonplace: If it's a generic, obvious, or unimportant statement (e.g. greetings, wrap-ups), DROP it.
4. Vague/Lacking Context: If the highlighted text is too short or lacks semantic weight on its own, DROP it.
5. Low confidence or uncertain.

Rule of thumb: Retain ONLY top-tier, essential quotes. When in doubt, DROP it. You should aim to drop at least 50% - 70% of the initial codes to keep the findings concise.

For each code, output if it should be kept or dropped.

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

        // Process all models concurrently to prevent Vercel 60s timeout
        const cleaningPromises = [];

        // 1. Process GPT codes
        if (suggestionsByModel.gpt.length > 0 && openai) {
            cleaningPromises.push((async () => {
                const promptText = CLEAN_PROMPT + JSON.stringify(suggestionsByModel.gpt, null, 2);
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini", // Use mini for faster cleaning, saving precious seconds
                    messages: [{ role: "user", content: promptText }],
                    response_format: { type: "json_object" },
                    temperature: 0.1
                });
                const resultJson = JSON.parse(completion.choices[0].message.content || '{"decisions":[]}');
                return (resultJson.decisions || []).filter((d: any) => d.action === 'DROP').map((d: any) => d.id);
            })().catch(e => { console.error('GPT clean error:', e); return []; }));
        }

        // 2. Process Claude codes
        if (suggestionsByModel.claude.length > 0 && anthropic) {
            cleaningPromises.push((async () => {
                const promptText = CLEAN_PROMPT + JSON.stringify(suggestionsByModel.claude, null, 2);
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
                return (resultJson.decisions || []).filter((d: any) => d.action === 'DROP').map((d: any) => d.id);
            })().catch(e => { console.error('Claude clean error:', e); return []; }));
        }

        // 3. Process Gemini codes
        if (suggestionsByModel.gemini.length > 0 && gemini) {
            cleaningPromises.push((async () => {
                const promptText = CLEAN_PROMPT + JSON.stringify(suggestionsByModel.gemini, null, 2);
                const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash', generationConfig: { responseMimeType: 'application/json' } });
                const result = await model.generateContent(promptText);
                const resultJson = JSON.parse(result.response.text() || '{"decisions":[]}');
                return (resultJson.decisions || []).filter((d: any) => d.action === 'DROP').map((d: any) => d.id);
            })().catch(e => { console.error('Gemini clean error:', e); return []; }));
        }

        // Wait for all 3 cleaning runs in parallel
        const results = await Promise.all(cleaningPromises);
        for (const dropIds of results) {
            if (Array.isArray(dropIds)) {
                allDropIds.push(...dropIds);
            }
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
