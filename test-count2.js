const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const themes = await prisma.theme.findMany();
    
    const countByProject = {};
    for (const t of themes) {
        if (!countByProject[t.projectId]) countByProject[t.projectId] = { total: 0, byStatus: {} };
        countByProject[t.projectId].total++;
        countByProject[t.projectId].byStatus[t.status] = (countByProject[t.projectId].byStatus[t.status] || 0) + 1;
    }
    console.log("Themes grouped by project:");
    console.dir(countByProject, { depth: null });
}
run();
