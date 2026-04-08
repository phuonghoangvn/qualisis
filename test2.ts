import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  try {
    const project = await prisma.project.create({
        data: {
            name: "Test2",
            description: undefined,
            coreOntology: "Test",
            researchQuestion: "Test",
            members: {
                create: {
                    userId: "cmnp4lei30000qwfca38bxyas",
                    role: "ADMIN"
                }
            }
        }
    });
    console.log("Success:", project.id);
  } catch(e) {
    console.error("Error creating:", e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
