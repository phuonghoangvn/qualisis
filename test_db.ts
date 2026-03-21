import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  const c1 = await prisma.codebookEntry.findUnique({
    where: { id: "cmmth349c00039fpi2fza64xt" },
    include: { _count: { select: { codeAssignments: true } } }
  })
  const c2 = await prisma.codebookEntry.findUnique({
    where: { id: "cmmy0b6d2005efll4bv5thotd" },
    include: { _count: { select: { codeAssignments: true } } }
  })
  console.log("C1 assignments:", c1?._count.codeAssignments)
  console.log("C2 assignments:", c2?._count.codeAssignments)
}

check().finally(() => prisma.$disconnect())
