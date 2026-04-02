import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const emptyDatasets = await prisma.dataset.findMany({
    where: {
      transcripts: {
        none: {}
      }
    }
  })

  console.log(`Found ${emptyDatasets.length} empty datasets.`)

  for (const d of emptyDatasets) {
    await prisma.dataset.delete({ where: { id: d.id } })
    console.log(`Deleted empty dataset: ${d.name} (${d.id})`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
