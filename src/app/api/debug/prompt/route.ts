import { NextResponse } from 'next/server'
import { buildAnalysisPrompt } from '@/lib/ai'

// GET /api/debug/prompt?text=...
// Returns the exact prompt that would be sent to AI models
export async function GET(req: Request) {
    const url = new URL(req.url)
    const text = url.searchParams.get('text') || 'Anna: Yes, that sounds fine. Thank you for having me.'
    const researchContext = url.searchParams.get('ctx') || undefined

    const prompt = buildAnalysisPrompt(text, researchContext, {}, '')

    return NextResponse.json({
        promptLength: prompt.length,
        prompt,
        note: 'This is the exact prompt sent to all AI models for analysis.'
    })
}
