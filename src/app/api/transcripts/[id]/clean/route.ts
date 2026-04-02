import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { openai, anthropic, gemini } from '@/lib/ai'

const CLEAN_PROMPT = `
You are an expert qualitative researcher. Review these "Initial Codes" (AI suggestions) for a transcript.
Drop any code that meets these criteria:
1. Duplicate/Highly overlapping with a better code (lặp lại)
2. Irrelevant to a research study (không liên quan)
3. Rare/trivial/unimportant (xuất hiện ít và không quan trọng)
4. Vague/unclear (mơ hồ, khó hiểu)
5. Low confidence or low semantic value

For each code, output if it should be kept or dropped.

JSON FORMAT:
{
  "decisions": [
    { "id": "code_id", "action": "KEEP" | "DROP", "reason": "brief reason if dropped" }
  ]
}

CODES TO ANALYZE:
`;

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const transcript = await prisma.transcript.findUnique({
            where: { id: params.id },
            include: {
                segments: {
                    include: { suggestions: true }
                },
                dataset: true,
            }
        });

        if (!transcript) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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
                    temperature: 0.2
                });
                const resultJson = JSON.parse(completion.choices[0].message.content || '{"decisions":[]}');
                const dropIds = (resultJson.decisions || []).filter((d: any) => d.action === 'DROP').map((d: any) => d.id);
                allDropIds.push(...dropIds);
            } catch (e) {
                console.error('GPT clean error:', e);
            }
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
                    temperature: 0.2
                });
                const content = 'text' in response.content[0] ? response.content[0].text : '{}';
                
                // Try to extract JSON if Claude wrapped it in markdown
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                const jsonStr = jsonMatch ? jsonMatch[0] : content;
                
                const resultJson = JSON.parse(jsonStr);
                const dropIds = (resultJson.decisions || []).filter((d: any) => d.action === 'DROP').map((d: any) => d.id);
                allDropIds.push(...dropIds);
            } catch (e) {
                console.error('Claude clean error:', e);
            }
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
            } catch (e) {
                console.error('Gemini clean error:', e);
            }
        }

        if (allDropIds.length > 0) {
            // Delete dropped suggestions completely to clean DB and UI
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

        const { revalidatePath } = require('next/cache');
        revalidatePath(`/projects/${transcript.dataset.projectId}/transcripts/${transcript.id}`);

        return NextResponse.json({ success: true, droppedCount: allDropIds.length });

    } catch (e: any) {
        console.error('Clean error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
