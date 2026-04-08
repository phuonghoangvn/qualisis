import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
    try {
        const { projectId } = params;

        const [themes, knowledgeEdges] = await Promise.all([
            prisma.theme.findMany({
                where: { projectId },
                include: {
                    codeLinks: {
                        include: {
                            codebookEntry: {
                                include: {
                                    codeAssignments: {
                                        include: {
                                            segment: { include: { transcript: true } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }),
            prisma.knowledgeEdge.findMany({ where: { projectId } })
        ]);

        const nodes: any[] = [];
        const edges: any[] = [];
        const transcriptMap = new Map<string, string>();

        themes.forEach(theme => {
            const codes = theme.codeLinks.map(link => ({
                id: link.codebookEntry.id,
                name: link.codebookEntry.name,
                count: link.codebookEntry.codeAssignments.length,
            }));

            nodes.push({
                id: `theme-${theme.id}`,
                type: 'themeNode',
                data: {
                    label: theme.name,
                    themeId: theme.id,
                    codeCount: theme.codeLinks.length,
                    description: theme.description,
                    codes,
                }
            });

            // Add code nodes
            theme.codeLinks.forEach(link => {
                const codeId = `code-${link.codebookEntry.id}`;
                if (!nodes.find(n => n.id === codeId)) {
                    nodes.push({
                        id: codeId,
                        type: 'codeNode',
                        data: {
                            label: link.codebookEntry.name,
                            codeId: link.codebookEntry.id,
                            count: link.codebookEntry.codeAssignments.length,
                            themeId: theme.id, // which theme this belongs to
                        }
                    });
                }

                // Implicit BELONGS_TO edge: theme → code
                edges.push({
                    id: `belongs-${link.codebookEntry.id}`,
                    source: `theme-${theme.id}`,
                    target: codeId,
                    type: 'belongsToEdge',
                    data: { implicit: true }
                });
            });

            // Participant → Theme edges
            theme.codeLinks.forEach(link => {
                link.codebookEntry.codeAssignments.forEach(assign => {
                    const t = assign?.segment?.transcript;
                    if (!t) return; // Skip if db relationship is ghosted
                    if (!transcriptMap.has(t.id)) transcriptMap.set(t.id, t.title);
                    const eid = `edge-participant-${t.id}-${theme.id}`;
                    const existing = edges.find(e => e.id === eid);
                    if (existing) { existing.data.weight += 1; }
                    else {
                        edges.push({
                            id: eid,
                            source: `participant-${t.id}`,
                            target: `theme-${theme.id}`,
                            type: 'participantEdge',
                            data: { weight: 1 }
                        });
                    }
                });
            });
        });

        // Add participant nodes
        transcriptMap.forEach((title, id) => {
            nodes.push({
                id: `participant-${id}`,
                type: 'participantNode',
                data: { label: title }
            });
        });

        // Add free-form knowledge edges
        knowledgeEdges.forEach(ke => {
            edges.push({
                id: `ke-${ke.id}`,
                source: ke.sourceNodeId,
                target: ke.targetNodeId,
                type: 'knowledgeEdge',
                data: {
                    edgeId: ke.id,
                    relationType: ke.relationType,
                    description: ke.description,
                }
            });
        });

        return NextResponse.json({ nodes, edges });
    } catch (e) {
        console.error("Graph Data Error:", e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
