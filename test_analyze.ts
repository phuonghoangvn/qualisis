import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  const trans = await prisma.transcript.findFirst({ where: { title: { contains: "Elia" } } })
  if (!trans) return console.log("Not found")
  
  console.log("Transcript ID:", trans.id)
  
  const res = await fetch(`http://localhost:3000/api/transcripts/${trans.id}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ models: ['gpt'] })
  })
  const text = await res.text()
  console.log("Analysis Result:", text)
}

check().finally(() => prisma.$disconnect())
