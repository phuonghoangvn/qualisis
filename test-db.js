const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const themes = await prisma.theme.findMany({
        where: { status: 'MERGED' }
    });
    console.log(`Merged Themes Count = ${themes.length}`);
    const newThemes = await prisma.theme.findMany({
        where: { memo: 'Synthesized from multiple smaller themes.' }
    });
    console.log(`New Synth Themes Count = ${newThemes.length}`);
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
