import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function run() {
    const deleted = await prisma.themeRelation.deleteMany({
        where: {
            sourceId: {
                equals: prisma.themeRelation.fields.targetId
            }
        }
    })
    console.log(`Deleted ${deleted.count} self-referencing theme relations.`)
}
run()
