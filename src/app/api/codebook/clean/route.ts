import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { openai } from '@/lib/ai'

// POST /api/codebook/clean — AI-powered code cleanup
// Identifies codes to drop: duplicates, low-frequency, vague, irrelevant, mergeable
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { projectId, researchQuestion } = body

        if (!projectId) {
            return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
        }

        // Fetch all codes with assignment counts
        const codes = await prisma.codebookEntry.findMany({
            where: { projectId },
            include: {
                _count: { select: { codeAssignments: true } },
                codeAssignments: {
                    include: {
                        aiSuggestion: { select: { confidence: true, label: true } }
                    },
                    take: 5
                }
            }
        })

        if (!codes.length) {
            return NextResponse.json({ suggestions: [], message: 'No codes to clean' })
        }

        // Build code summary for AI analysis
        const codeSummary = codes.map(c => ({
            id: c.id,
            name: c.name,
            definition: c.definition?.substring(0, 100) || '',
            instances: c._count.codeAssignments,
            type: c.type,
            avgConfidence: c.codeAssignments
                .filter(a => a.aiSuggestion?.confidence)
                .map(a => a.aiSuggestion!.confidence)
                .join(', ') || 'N/A'
        }))

        if (!openai) {
            // Fallback heuristic-based cleaning without AI
            const suggestions = codes.map(code => {
                const reasons: string[] = []
                const instances = code._count.codeAssignments

                // Low frequency
                if (instances <= 1) reasons.push('Appears only once — may not be significant')
                
                // Check for potential duplicates (simple similarity)
                const similar = codes.filter(other => 
                    other.id !== code.id && 
                    (other.name.toLowerCase().includes(code.name.toLowerCase().split(' ')[0]) ||
                     code.name.toLowerCase().includes(other.name.toLowerCase().split(' ')[0]))
                )
                if (similar.length > 0) {
                    reasons.push(`Potentially duplicate with: ${similar.map(s => s.name).join(', ')}`)
                }

                // Low confidence
                const confidences = code.codeAssignments
                    .filter(a => a.aiSuggestion?.confidence)
                    .map(a => a.aiSuggestion!.confidence)
                if (confidences.every(c => c === 'LOW')) {
                    reasons.push('All AI suggestions had LOW confidence')
                }

                return reasons.length > 0 ? {
                    codeId: code.id,
                    codeName: code.name,
                    action: reasons.some(r => r.includes('duplicate')) ? 'MERGE' : 'DROP',
                    reasons,
                    instances,
                    confidence: 'HEURISTIC'
                } : null
            }).filter(Boolean)

            return NextResponse.json({ suggestions, method: 'heuristic' })
        }

        // AI-powered analysis
        const prompt = `You are a qualitative research expert reviewing initial codes from thematic analysis.

Research Question: "${researchQuestion || 'Not specified'}"

Here are the current codes:
${JSON.stringify(codeSummary, null, 2)}

Analyze these codes and identify which ones should be DROPPED or MERGED. A code should be dropped if:
1. It is a DUPLICATE of another code (same meaning, different wording)
2. It is IRRELEVANT to the research question
3. It appears too INFREQUENTLY (≤1 instance) and isn't theoretically important
4. It is too VAGUE or unclear in meaning
5. It can be MERGED into a broader, more meaningful code
6. It has consistently LOW confidence scores

For each code you recommend dropping/merging, provide:
- codeId (from the data)
- codeName
- action: "DROP" or "MERGE"  
- mergeInto: (if MERGE, which code ID to merge into)
- reasons: array of specific reasons
- confidence: "HIGH", "MEDIUM", or "LOW"

Return ONLY a JSON array of recommendations. Keep important codes — only flag truly redundant or low-quality ones.
Return format: [{"codeId":"...", "codeName":"...", "action":"DROP|MERGE", "mergeInto":"...", "reasons":["..."], "confidence":"HIGH|MEDIUM|LOW"}]`

        const res = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.2,
            messages: [{ role: 'user', content: prompt }],
        })

        const raw = res.choices[0]?.message?.content ?? '[]'
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        
        try {
            const suggestions = JSON.parse(cleaned)
            return NextResponse.json({ suggestions, method: 'ai' })
        } catch {
            return NextResponse.json({ suggestions: [], error: 'Failed to parse AI response', raw: cleaned })
        }
    } catch (e) {
        console.error('Code cleanup error:', e)
        return NextResponse.json({ error: 'Failed to clean codes', details: String(e) }, { status: 500 })
    }
}
