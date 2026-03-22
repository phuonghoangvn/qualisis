import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function migrate() {
  const users = await prisma.user.findMany()
  if (users.length === 0) {
    console.log("No users found to assign projects to.");
    return;
  }
  const firstUser = users.find(u => u.email === 'demo@example.com') || users[0];
  console.log("Assigning all projects to user:", firstUser.email);
  const projects = await prisma.project.findMany();
  for (const p of projects) {
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: p.id,
          userId: firstUser.id
        }
      },
      update: {},
      create: {
        projectId: p.id,
        userId: firstUser.id,
        role: "ADMIN"
      }
    })
  }
  console.log("Migrated", projects.length, "projects.");
}
migrate().finally(() => prisma.$disconnect())
