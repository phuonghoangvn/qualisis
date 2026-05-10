import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildSystematicPrompt } from '@/lib/prompts';

export async function GET(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        // 1. Auth check
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // 2. Fetch project context
        const project = await prisma.project.findUnique({
            where: { id: params.projectId }
        });

        if (!project) {
            return new NextResponse('Project not found', { status: 404 });
        }

        const projectContextPieces = [];
        if (project.description) projectContextPieces.push(`Project Description: ${project.description}`);
        if (project.researchQuestion) projectContextPieces.push(`Research Question: ${project.researchQuestion}`);
        if (project.coreOntology) projectContextPieces.push(`Core Ontology / Known Concepts: ${project.coreOntology}`);
        const researchContext = projectContextPieces.join('\n');

        // 3. Fetch all transcripts with their segments that are human coded or approved
        const transcripts = await prisma.transcript.findMany({
            where: { dataset: { projectId: params.projectId } },
            include: {
                segments: {
                    include: {
                        codeAssignments: {
                            include: {
                                codebookEntry: {
                                    include: { themeLinks: { include: { theme: true } } }
                                }
                            }
                        },
                        suggestions: {
                            where: { status: { in: ['APPROVED', 'MODIFIED'] } }
                        }
                    }
                }
            }
        });

        let jsonlContent = '';
        let exportCount = 0;

        for (const transcript of transcripts) {
            // Collect approved segments for this transcript
            const approvedData = [];

            for (const segment of transcript.segments) {
                let label = null;
                let theme = 'Uncategorized';
                let explanation = 'Human coded or approved suggestion.';

                if (segment.codeAssignments.length > 0) {
                    const codeAssign = segment.codeAssignments[0];
                    label = codeAssign.codebookEntry.name;
                    
                    if (codeAssign.codebookEntry.themeLinks.length > 0) {
                        theme = codeAssign.codebookEntry.themeLinks[0].theme.name;
                    }
                } else if (segment.suggestions.length > 0) {
                    const sugg = segment.suggestions[0];
                    label = sugg.label;
                    explanation = sugg.explanation;
                    // Try to extract theme if it's stored in uncertainty JSON (optional)
                    try {
                        if (sugg.uncertainty) {
                            const uncert = JSON.parse(sugg.uncertainty);
                            if (uncert.theme) theme = uncert.theme;
                        }
                    } catch (e) {}
                }

                if (label) {
                    approvedData.push({
                        theme: theme,
                        label: label,
                        alternatives: [],
                        text: segment.text,
                        sentiment: "Neutral",
                        confidence: "HIGH",
                        explanation: explanation
                    });
                }
            }

            // Only include transcript if it has at least one approved segment
            if (approvedData.length > 0) {
                const metadata = typeof transcript.metadata === 'string' ? JSON.parse(transcript.metadata) : (transcript.metadata || {});
                
                // Build the system prompt using standard prompt building
                const finalResearchContext = researchContext ? `[GLOBAL PROJECT CONTEXT]\n${researchContext}\n` : 'Focus on identifying statements made by participants about their experiences, feelings, and perceptions.';
                
                const systemPrompt = buildSystematicPrompt(finalResearchContext, metadata, 'Global summary for this transcript.');

                const message = {
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: transcript.content },
                        { role: "assistant", content: JSON.stringify(approvedData, null, 2) }
                    ]
                };

                jsonlContent += JSON.stringify(message) + '\n';
                exportCount++;
            }
        }

        if (exportCount === 0) {
            return new NextResponse('No approved or human-coded transcripts found to export. Please code some data first.', { status: 400 });
        }

        // Return as a downloadable file
        return new NextResponse(jsonlContent, {
            headers: {
                'Content-Type': 'application/jsonl',
                'Content-Disposition': `attachment; filename="project_${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_finetune.jsonl"`,
            }
        });
    } catch (error) {
        console.error('Export Fine-tune Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
