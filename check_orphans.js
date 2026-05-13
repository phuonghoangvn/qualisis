const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const PROJECT_ID = 'cmoy5rixt001gcozukzedl81l';
    
    // Find themes that do NOT have any relationOut where relationType = SUBTHEME_OF
    // AND they are NOT mega-themes (do NOT have relationIn)
    const orphans = await prisma.theme.findMany({
        where: {
            projectId: PROJECT_ID,
            relationsOut: { none: { relationType: 'SUBTHEME_OF' } },
            relationsIn: { none: { relationType: 'SUBTHEME_OF' } }
        },
        include: {
            codeLinks: true
        }
    });

    console.log(`Orphan themes (${orphans.length}):`);
    for (const o of orphans) {
        console.log(`- ${o.name} (has ${o.codeLinks.length} codes)`);
    }
    process.exit(0);
}

main().catch(console.error);
