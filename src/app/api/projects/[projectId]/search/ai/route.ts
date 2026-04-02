import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * Expected LLM output schema for the rule engine
 */
interface QueryRule {
    codeName: string
    operator: 'INCLUDES' | 'EXCLUDES'
}
interface QueryFilter {
    condition: 'AND' | 'OR'
    rules: QueryRule[]
    humanExplanation: string
}

export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const { query } = await req.json()
        if (!query) return NextResponse.json({ error: 'Query is missing' }, { status: 400 })

        // 1. Fetch available codes
        const codebook = await prisma.codebookEntry.findMany({
            where: { projectId: params.projectId },
            select: { name: true, definition: true }
        })

        const codebookList = codebook.map(c => `- ${c.name}: ${c.definition || 'No definition'}`).join('\n')

        // 2. Ask LLM to parse natural query into Boolean JSON
        const systemPrompt = `You are a data filtering engine for qualitative research.
The user wants to find interview quotes based on a Natural Language boolean query (e.g. "x AND y BUT NOT z").
Map their query strictly to the provided available Codebook codes.

AVAILABLE CODES:
${codebookList}

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
{
  "condition": "AND" | "OR",
  "rules": [
    { "codeName": "Exact Name From Available Codes", "operator": "INCLUDES" | "EXCLUDES" }
  ],
  "humanExplanation": "Brief explanation of what this filter does (e.g., 'Looking for quotes coded with X and Y, excluding Z')"
}

If you cannot match the user's intent to any codes, return an empty rules array.`

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: query }
            ],
            response_format: { type: 'json_object' }
        })

        const filterJson = completion.choices[0]?.message?.content || '{}'
        const filter: QueryFilter = JSON.parse(filterJson)

        if (!filter.rules || filter.rules.length === 0) {
            return NextResponse.json({ results: [], explanation: "Couldn't match your query to existing codes in the codebook." })
        }

        // 3. Fetch all coded segments for the project
        // Note: For massive DBs we'd translate to Prisma SQL, but for typical qualitative projects (<10k quotes), JS filtering is extremely fast.
        const allSegments = await prisma.segment.findMany({
            where: {
                transcript: { dataset: { projectId: params.projectId } },
                codeAssignments: { some: {} } // only segments that have at least one code
            },
            include: {
                transcript: { select: { id: true, title: true, dataset: { select: { name: true } } } },
                codeAssignments: { include: { codebookEntry: { select: { name: true, id: true } } } }
            }
        })

        // 4. Apply the Custom JS Filter Engine based on the LLM's AST
        const matchedSegments = allSegments.filter(segment => {
            const segmentCodeNames = segment.codeAssignments.map(ca => ca.codebookEntry.name.toLowerCase())
            
            const evaluateRule = (rule: QueryRule) => {
                const target = rule.codeName.toLowerCase()
                const hasCode = segmentCodeNames.includes(target)
                return rule.operator === 'INCLUDES' ? hasCode : !hasCode
            }

            if (filter.condition === 'AND') {
                return filter.rules.every(evaluateRule)
            } else {
                return filter.rules.some(evaluateRule)
            }
        })

        // 5. Group the results similarly to standard Search
        const groupedResults = matchedSegments.reduce((acc, segment) => {
            const tId = segment.transcriptId
            if (!acc[tId]) {
                acc[tId] = {
                    transcriptId: tId,
                    transcriptName: segment.transcript.title,
                    datasetName: segment.transcript.dataset.name,
                    segments: []
                }
            }
            acc[tId].segments.push({
                id: segment.id,
                text: segment.text,
                codes: segment.codeAssignments.map(ca => ({
                    id: ca.codebookEntry.id,
                    name: ca.codebookEntry.name
                }))
            })
            return acc
        }, {} as Record<string, any>)

        return NextResponse.json({
            results: Object.values(groupedResults),
            totalSegments: matchedSegments.length,
            explanation: filter.humanExplanation,
            parsedQuery: filter
        })

    } catch (e: any) {
        console.error('AI Query failed:', e)
        return NextResponse.json({ error: 'Failed to process AI query' }, { status: 500 })
    }
}
