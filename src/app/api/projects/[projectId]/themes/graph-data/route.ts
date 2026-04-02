import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
    try {
        const { projectId } = params;

        const themes = await prisma.theme.findMany({
            where: { projectId },
            include: {
                codeLinks: {
                    include: {
                        codebookEntry: {
                            include: {
                                codeAssignments: {
                                    include: {
                                        segment: {
                                            include: {
                                                transcript: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const nodes: any[] = [];
        const edges: any[] = [];
        const transcriptMap = new Map();

        themes.forEach(theme => {
            nodes.push({ 
                id: `theme-${theme.id}`, 
                type: 'themeNode', 
                data: { label: theme.name, themeId: theme.id, codeCount: theme.codeLinks.length, description: theme.description } 
            });
            
            theme.codeLinks.forEach(link => {
                link.codebookEntry.codeAssignments.forEach(assign => {
                    const transcript = assign.segment.transcript;
                    if (!transcriptMap.has(transcript.id)) {
                        transcriptMap.set(transcript.id, transcript.title);
                    }
                    const edgeId = `edge-${transcript.id}-${theme.id}`;
                    const existingEdge = edges.find(e => e.id === edgeId);
                    if (existingEdge) {
                        existingEdge.data.weight += 1;
                    } else {
                        edges.push({
                            id: edgeId,
                            source: `participant-${transcript.id}`,
                            target: `theme-${theme.id}`,
                            animated: true,
                            data: { weight: 1 }
                        });
                    }
                });
            });
        });

        Array.from(transcriptMap.entries()).forEach(([id, title]) => {
            nodes.push({ 
                id: `participant-${id}`, 
                type: 'participantNode', 
                data: { label: title } 
            });
        });

        return NextResponse.json({ nodes, edges });
    } catch (e) {
        console.error("Graph Data Error:", e);
        return NextResponse.json({ error: "Failed to fetch graph data" }, { status: 500 });
    }
}
