import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import { mergeAndComputeConsensus } from './src/lib/ai'

async function run() {
    const sugDB = await prisma.aISuggestion.findMany({
        include: { segment: true }
    });
    
    // reconstruct the "results" array that `mergeAndComputeConsensus` expects
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
    
    const multi = merged.filter(m => Object.keys(m.models).length > 1);
    console.log(`Simulated merge: ${merged.length} segments, ${multi.length} merged.`);
    
    // Let's print the first 5 unmerged from different models, maybe there are overlaps
    const sorted = merged.sort((a,b) => a.startIndex - b.startIndex);
    for (let i = 0; i < Math.min(10, sorted.length); i++) {
        console.log(`[${sorted[i].startIndex}-${sorted[i].endIndex}] ${Object.keys(sorted[i].models).join(',')}: "${sorted[i].text.substring(0, 30)}" -> ${sorted[i].consensusLabel}`);
    }
}
run();
