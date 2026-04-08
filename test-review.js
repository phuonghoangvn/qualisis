const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const suggestion = await prisma.aISuggestion.findFirst({
        include: { segment: true }
    });
    if (!suggestion) {
        console.log("No suggestion found");
        return;
    }
    console.log("Found suggestion:", suggestion.id, "Segment:", suggestion.segmentId);
    
    // Simulate API route logic
    try {
        const action = "ACCEPT";
        const note = "Test note";
        const customLabel = null;
        const suggestionId = suggestion.id;
        
        const finalLabel = action === 'OVERRIDE' && customLabel ? customLabel : suggestion.label;
        const finalDefinition = note ? `${suggestion.explanation}\n\n[Researcher Note]: ${note}` : suggestion.explanation;

        // Mock transcription
        const transcriptData = await prisma.transcript.findUnique({
            where: { id: suggestion.segment.transcriptId },
            include: { dataset: true }
        });
        const projectId = transcriptData?.dataset.projectId;

        let codebookEntry = await prisma.codebookEntry.findFirst({
            where: {
                name: { equals: finalLabel, mode: 'insensitive' },
                projectId: { not: undefined }
            }
        });

        console.log("Codebook entry found?", !!codebookEntry);

        if (!codebookEntry && projectId) {
            console.log("Attempting to create codebookEntry...");
            codebookEntry = await prisma.codebookEntry.create({
                data: {
                    projectId,
                    name: finalLabel,
                    definition: finalDefinition,
                    type: 'RAW',
                    examplesIn: `"${suggestion.segment.text.substring(0, 100)}"`,
                    examplesOut: '',
                }
            });
            console.log("Created codebook successfully");
        } else if (codebookEntry && note) {
            console.log("Attempting to update codebookEntry...");
            if (!codebookEntry.definition?.includes(note)) {
                await prisma.codebookEntry.update({
                    where: { id: codebookEntry.id },
                    data: {
                        definition: `${codebookEntry.definition || ''}\n\n[Additional Review Note]: ${note}`.trim()
                    }
                });
                console.log("Updated codebook successfully");
            }
        }
        
    } catch (e) {
        console.error("ERROR CAUGHT IN LOGIC:", e);
    }
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
