import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function run() {
    const themes = await prisma.theme.findMany({
        where: { name: { contains: "Benefit" } },
        include: {
            relationsIn: true,
            relationsOut: true,
            codeLinks: { include: { codebookEntry: true } }
        }
    })
    console.log(JSON.stringify(themes, null, 2))
}
run()
