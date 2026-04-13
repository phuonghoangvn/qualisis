import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const projects = await prisma.project.findMany();
    for (const p of projects) {
        const codes = await prisma.codebookEntry.count({ where: { projectId: p.id }});
        if (codes > 100) {
            console.log(`Project ${p.id} (${p.name}): ${codes} codes`);
        }
    }
}
run().catch(console.error).finally(() => prisma.$disconnect());
