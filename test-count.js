const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const project = await prisma.project.findFirst();
    const themes = await prisma.theme.findMany({ where: { projectId: project.id } });
    
    const countByStatus = {};
    for (const t of themes) {
        countByStatus[t.status] = (countByStatus[t.status] || 0) + 1;
    }
    console.log("Total themes:", themes.length);
    console.log("By status:", countByStatus);
}
run();
