import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function run() {
    const projectId = 'cm1zxz8j70000jqwk47wq2fqv'; // Need the actual project ID, I can get it from DB.
    
    const projects = await prisma.project.findMany();
    if (projects.length === 0) { console.log('No projects'); return; }
    
    // Pick the one with the most codes
    let highestCodeCount = -1;
    let targetProject = projects[0].id;
    for (const p of projects) {
        const codes = await prisma.codebookEntry.count({ where: { projectId: p.id }});
        if (codes > highestCodeCount) {
            highestCodeCount = codes;
            targetProject = p.id;
        }
    }
    console.log(`Using project ${targetProject} with ${highestCodeCount} codes.`);
    
    const codebookEntries = await prisma.codebookEntry.findMany({
        where: { projectId: targetProject },
        include: {
            codeAssignments: {
                include: { segment: { select: { text: true } } },
                take: 5
            },
            _count: { select: { codeAssignments: true } },
            themeLinks: true
        }
    });

    const unassignedCodes = codebookEntries.filter(c => 
        c._count.codeAssignments > 0 && c.themeLinks.length === 0
    );
    console.log(`Unassigned codes: ${unassignedCodes.length}`);
    if (unassignedCodes.length < 2) return;

    // Run heuristcs
    console.log('Testing heuristics...');
    const hSuggestions = generateFallbackSuggestions(unassignedCodes);
    console.log('Heuristics generated themes:', hSuggestions.length);

    const codesSummary = unassignedCodes.map(code => {
        const examples = code.codeAssignments
            .map(a => `"${a.segment.text.slice(0, 120)}"`)
            .join('\n    ')
        return `- "${code.name}" (${code._count.codeAssignments} instances, type: ${code.type})${code.definition ? `\n  Definition: ${code.definition}` : ''}${examples ? `\n  Example quotes:\n    ${examples}` : ''}`
    }).join('\n');
    
    console.log('Codes summary length:', codesSummary.length);
    
    const prompt = `[ROLE]... [MOCK PROMPT] Return ONLY JSON\n${codesSummary.substring(0, 5000)}`; 
    // console.log(prompt);
}

function generateFallbackSuggestions(codes: any[]) {
    const suggestions: any[] = []
    const used = new Set<string>()

    for (let i = 0; i < codes.length; i++) {
        if (used.has(codes[i].id)) continue
        
        const group = [codes[i]]
        const words1 = new Set(codes[i].name.toLowerCase().split(/\s+/))
        
        for (let j = i + 1; j < codes.length; j++) {
            if (used.has(codes[j].id)) continue
            const words2 = new Set(codes[j].name.toLowerCase().split(/\s+/))
            const overlap = Array.from(words1).filter(w => words2.has(w as string) && (w as string).length > 3).length
            
            const def1 = (codes[i].definition || '').toLowerCase()
            const def2 = (codes[j].definition || '').toLowerCase()
            const defOverlap = def1 && def2 && 
                def1.split(/\s+/).filter((w: string) => def2.includes(w) && w.length > 4).length > 2

            if (overlap > 0 || defOverlap) {
                group.push(codes[j])
            }
        }

        if (group.length >= 2) {
            group.forEach(g => used.add(g.id))
            suggestions.push({
                name: `Theme: ${group[0].name.split(' ')[0]}`,
                codes: group
            })
        }
    }
    return suggestions
}
run().catch(console.error).finally(() => prisma.$disconnect());
