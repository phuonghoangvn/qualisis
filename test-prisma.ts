import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst();
  if(!user) {
    console.log("No users found");
    return;
  }
  try {
    const project = await prisma.project.create({
        data: {
            name: "Test",
            description: "Test Desc",
            coreOntology: "Test Ont",
            researchQuestion: "Test RQ",
            members: {
                create: {
                    userId: user.id,
                    role: 'ADMIN'
                }
            }
        }
    });
    console.log("Success:", project.id);
    
    // cleanup
    await prisma.project.delete({where: {id: project.id}});
  } catch(e) {
    console.log("Error:", e);
  }
}

run().finally(() => prisma.$disconnect());
