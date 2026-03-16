const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testDelete() {
    const projects = await prisma.project.findMany()
    console.log(`Found ${projects.length} projects`)
    for (const p of projects) {
        if (p.name.includes('Test Project') || true) {
            console.log(`Testing deletion of ${p.name}...`)
            try {
                const projectId = p.id
                
                await prisma.codebookEntry.updateMany({ where: { projectId }, data: { mappedToId: null } })
                await prisma.auditLog.deleteMany({ where: { projectId } })
                await prisma.reportSection.deleteMany({ where: { projectId } })
                
                const themes = await prisma.theme.findMany({ where: { projectId }, select: { id: true } })
                const themeIds = themes.map((t: any) => t.id)
                if (themeIds.length > 0) {
                    await prisma.themeRelation.deleteMany({ where: { OR: [{ sourceId: { in: themeIds } }, { targetId: { in: themeIds } }] } })
                    await prisma.themeCodeLink.deleteMany({ where: { themeId: { in: themeIds } } })
                }
                await prisma.theme.deleteMany({ where: { projectId } })
                
                const datasets = await prisma.dataset.findMany({ where: { projectId }, select: { id: true } })
                const datasetIds = datasets.map((d: any) => d.id)
                if (datasetIds.length > 0) {
                    const transcripts = await prisma.transcript.findMany({ where: { datasetId: { in: datasetIds } }, select: { id: true } })
                    const transcriptIds = transcripts.map((t: any) => t.id)
                    if (transcriptIds.length > 0) {
                        const segments = await prisma.segment.findMany({ where: { transcriptId: { in: transcriptIds } }, select: { id: true } })
                        const segmentIds = segments.map((s: any) => s.id)
                        if (segmentIds.length > 0) {
                            await prisma.codeAssignment.deleteMany({ where: { segmentId: { in: segmentIds } } })
                            const suggestions = await prisma.aISuggestion.findMany({ where: { segmentId: { in: segmentIds } }, select: { id: true } })
                            const suggestionIds = suggestions.map((s: any) => s.id)
                            if (suggestionIds.length > 0) {
                                await prisma.aISuggestionEvidence.deleteMany({ where: { aiSuggestionId: { in: suggestionIds } } })
                                await prisma.reviewDecision.deleteMany({ where: { aiSuggestionId: { in: suggestionIds } } })
                            }
                            await prisma.aISuggestion.deleteMany({ where: { segmentId: { in: segmentIds } } })
                            await prisma.segment.deleteMany({ where: { transcriptId: { in: transcriptIds } } })
                        }
                        await prisma.transcript.deleteMany({ where: { datasetId: { in: datasetIds } } })
                    }
                    await prisma.dataset.deleteMany({ where: { projectId } })
                }
                
                await prisma.codebookEntry.deleteMany({ where: { projectId } })
                await prisma.projectMember.deleteMany({ where: { projectId } })
                await prisma.project.delete({ where: { id: projectId } })
                console.log(`Deleted successfully!`)
            } catch (err: any) {
                console.error(`Error deleting project ${p.name}:`, err.message || err)
            }
        }
    }
}
testDelete().finally(() => prisma.$disconnect())
