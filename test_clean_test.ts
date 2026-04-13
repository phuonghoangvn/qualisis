import { autoCleanHighlights } from './src/lib/clean';
import { prisma } from './src/lib/prisma';

async function run() {
    const t = await prisma.transcript.findFirst();
    if(t) {
       console.log("Found transcript:", t.id);
       const tFull = await prisma.transcript.findUnique({
           where: { id: t.id },
           include: { segments: { include: { suggestions: true } } }
       });
       let suggCount = 0;
       tFull?.segments.forEach(s => suggCount += s.suggestions.length);
       console.log("Total suggestions in DB:", suggCount);

       const result = await autoCleanHighlights(t.id);
       console.log("Dropped count:", result);
    } else {
        console.log("No transcript found.");
    }
}
run().catch(console.error).finally(() => process.exit(0));
