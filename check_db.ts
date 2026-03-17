import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function run() {
    const segments = await prisma.segment.findMany({
        include: { suggestions: true }
    });
    const multi = segments.filter(s => s.suggestions.length > 1);
    console.log(`Total segments: ${segments.length}, Segments with >1 suggestions: ${multi.length}`);
    for (const m of multi) {
        console.log(`Segment ${m.id} text: "${m.text.substring(0, 50)}...", models: ${m.suggestions.map(s => s.modelProvider).join(', ')}`);
    }
}
run();
