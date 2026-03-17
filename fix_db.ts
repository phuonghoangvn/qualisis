import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import { mergeAndComputeConsensus } from './src/lib/ai'

async function fixDB() {
    const transcripts = await prisma.transcript.findMany({ include: { segments: { include: { suggestions: true } } } });
    for (const t of transcripts) {
        const sugDB = await prisma.aISuggestion.findMany({
            where: { segment: { transcriptId: t.id } },
            include: { segment: true }
        });
        if (sugDB.length === 0) continue;
        
        const byModel: Record<string, any[]> = {};
        for (const sug of sugDB) {
            const model = sug.modelProvider || 'unknown';
            if (!byModel[model]) byModel[model] = [];
            byModel[model].push({
                text: sug.segment.text,
                startIndex: sug.segment.startIndex,
                endIndex: sug.segment.endIndex,
                label: sug.label,
                explanation: sug.explanation,
                confidence: sug.confidence,
                alternatives: sug.alternatives,
                uncertainty: sug.uncertainty,
            });
        }
        
        const results = Object.keys(byModel).map(m => ({ model: m, suggestions: byModel[m] }));
        const merged = mergeAndComputeConsensus(results);
        
        console.log(`Transcript ${t.id}: ${sugDB.length} suggestions -> ${merged.length} segments`);

        await prisma.aISuggestion.deleteMany({ where: { segment: { transcriptId: t.id } } });
        await prisma.segment.deleteMany({ where: { transcriptId: t.id } });
        
        for (let idx = 0; idx < merged.length; idx++) {
            const seg = merged[idx];
            const newSeg = await prisma.segment.create({
                data: {
                    transcriptId: t.id,
                    text: seg.text,
                    startIndex: seg.startIndex,
                    endIndex: seg.endIndex,
                    order: idx,
                }
            });

            for (const [modelName, modelData] of Object.entries(seg.models)) {
                await prisma.aISuggestion.create({
                    data: {
                        segmentId: newSeg.id,
                        label: modelData.label,
                        explanation: modelData.explanation,
                        confidence: modelData.confidence,
                        alternatives: modelData.alternatives,
                        uncertainty: modelData.uncertainty,
                        modelProvider: modelName,
                        status: 'SUGGESTED',
                    }
                })
            }
        }
    }
    console.log('Fixed DB');
}

fixDB().catch(console.error).finally(() => prisma.$disconnect());
