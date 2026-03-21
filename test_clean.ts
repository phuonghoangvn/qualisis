import { prisma } from './src/lib/prisma'
import { autoCleanHighlights } from './src/lib/clean'

async function check() {
  const trans = await prisma.transcript.findFirst({ where: { title: { contains: "Elia" } } })
  if (!trans) return console.log("Not found")
  console.log("Analyzing autoClean...")
  const count = await autoCleanHighlights(trans.id)
  console.log("Dropped Count:", count)
}

check()
