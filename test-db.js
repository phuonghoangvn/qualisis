const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const participants = await prisma.participant.findMany();
    console.log(participants);
}
main();
