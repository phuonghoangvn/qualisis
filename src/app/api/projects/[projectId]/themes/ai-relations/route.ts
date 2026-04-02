import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const body = await req.json()
        const { themes } = body as {
            themes: { id: string; name: string; codes: string[] }[]
        }

        if (!themes || themes.length < 2) {
            return NextResponse.json({ suggestions: [] })
        }

        const prompt = `You are a qualitative research methodology expert specializing in Grounded Theory and Thematic Analysis.

A researcher has identified the following themes and their associated codes from interview data:

${themes.map(t => `THEME: "${t.name}"\nCODES: ${t.codes.join(', ')}`).join('\n\n')}

Analyze these themes and suggest meaningful relationships between them. For each relationship, determine:
1. Which two themes are connected
2. The type of relationship (CAUSES, CONTRADICTS, SUPPORTS, RELATED_TO, SUBTHEME_OF, MITIGATES)
3. A brief evidence-based reason (1 sentence) grounded in what the codes suggest

Respond ONLY with valid JSON in this exact format:
{
  "suggestions": [
    {
      "sourceId": "<theme_id>",
      "targetId": "<theme_id>",
      "relationType": "CAUSES",
      "reason": "The codes in Theme A frequently describe triggers that lead to behaviors coded under Theme B."
    }
  ]
}

Rules:
- Suggest 2-5 relationships maximum
- Only suggest relationships that are genuinely evidenced by the codes
- Do not suggest relationships between all theme pairs – only meaningful ones
- Use the exact theme IDs provided above`

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.3,
        })

        const raw = response.choices[0]?.message?.content || '{}'
        const parsed = JSON.parse(raw)

        return NextResponse.json({ suggestions: parsed.suggestions || [] })
    } catch (e) {
        console.error('AI relations failed:', e)
        return NextResponse.json({ suggestions: [] })
    }
}
