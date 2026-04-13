import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function run() {
    const projects = await prisma.project.findMany();
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

    const codesSummary = unassignedCodes.map(code => {
        const examples = code.codeAssignments
            .map(a => `"${a.segment.text.slice(0, 120)}"`)
            .join('\n    ')
        return `- "${code.name}" (${code._count.codeAssignments} instances, type: ${code.type})${code.definition ? `\n  Definition: ${code.definition}` : ''}${examples ? `\n  Example quotes:\n    ${examples}` : ''}`
    }).join('\n');
    
    const prompt = `[ROLE]
You are a senior qualitative researcher performing Steps 3-4 of thematic analysis: creating categories (themes) by grouping initial codes together.
[CODE SUMMARY]
${codesSummary}
[OUTPUT FORMAT]
Return a JSON array:
[
  {
    "name": "Plain-English Finding Name",
    "description": "...",
    "reason": "...",
    "confidenceScore": 85,
    "codeNames": ["MUST exactly match the Code names provided above", "..."]
  }
]
Return ONLY the JSON array. No markdown wrappers.`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.choices[0]?.message?.content ?? '[]';
    console.log('RAW AI OUTPUT:');
    console.log(raw);

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const suggestions = JSON.parse(cleaned)
    console.log('PARSED', suggestions.length);
    
    const enriched = suggestions.map((s: any) => ({
        ...s,
        codes: (s.codeNames || []).map((name: string) => {
            const cleanName = name.trim().toLowerCase();
            let entry = unassignedCodes.find(c => c.name.toLowerCase() === cleanName);
            if (!entry) {
                entry = unassignedCodes.find(c => c.name.toLowerCase().includes(cleanName) || cleanName.includes(c.name.toLowerCase()));
            }
            return entry ? { id: entry.id, name: entry.name } : null;
        }).filter(Boolean)
    })).filter((s: any) => s.codes && s.codes.length > 0);
    console.log('ENRICHED', enriched.length);
}
run().catch(console.error).finally(() => prisma.$disconnect());
