import { prisma } from './src/lib/prisma'
import { analyzeWithGPT } from './src/lib/ai'

async function check() {
  const trans = await prisma.transcript.findFirst({ where: { title: { contains: "Elia" } } })
  if (!trans) return console.log("Not found")
  console.log("Analyzing chunk...")
  const res = await analyzeWithGPT(trans.content, "General context");
  console.log(JSON.stringify(res, null, 2))
}

check()
