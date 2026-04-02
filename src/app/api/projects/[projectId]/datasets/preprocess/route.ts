export const maxDuration = 60; // Max allowed for Vercel Hobby
import { NextResponse } from 'next/server'
import { openai } from '@/lib/ai'

// POST /api/projects/[projectId]/datasets/preprocess
// Pre-process transcript content: detect language, translate if needed, label speakers
export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const body = await req.json()
        const { content, options } = body

        if (!content || typeof content !== 'string') {
            return NextResponse.json({ error: 'Missing content' }, { status: 400 })
        }

        const autoTranslate = options?.autoTranslate ?? true
        const autoSpeakerDetect = options?.autoSpeakerDetect ?? true

        if (!openai) {
            return NextResponse.json({ 
                error: 'AI not available — please set OPENAI_API_KEY in .env',
                processedContent: content,
            }, { status: 422 })
        }

        let processedContent = content
        const steps: string[] = []

        // Step 1: Detect language + translate if needed
        if (autoTranslate) {
            const detectPrompt = `Analyze this text and determine:
1. What language is this text in?
2. If it's NOT English, translate the ENTIRE text to English while preserving speaker labels, formatting, and meaning precisely.

If the text is ALREADY in English, respond with:
{"language": "English", "needsTranslation": false}

If translation is needed, respond with:
{"language": "<detected language>", "needsTranslation": true, "translatedText": "<full translated text>"}

IMPORTANT: 
- Preserve all line breaks, speaker labels, and formatting exactly
- Translate naturally while keeping cultural context
- Keep proper nouns and names as-is
- Return ONLY valid JSON, no markdown

Text to analyze:
${content.substring(0, 8000)}`

            const detectRes = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                temperature: 0.1,
                messages: [{ role: 'user', content: detectPrompt }],
            })

            const detectRaw = detectRes.choices[0]?.message?.content ?? '{}'
            try {
                const cleaned = detectRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
                const detection = JSON.parse(cleaned)
                
                if (detection.needsTranslation && detection.translatedText) {
                    // If we only translated a sample, translate the full text
                    if (content.length > 8000) {
                        const fullTranslatePrompt = `Translate this complete text from ${detection.language} to English.
Preserve all line breaks, speaker labels (like "Interviewer:", "Q:", etc.), formatting, and structure exactly.
Return ONLY the translated text, no wrappers.

${content}`
                        const fullRes = await openai.chat.completions.create({
                            model: 'gpt-4o-mini',
                            temperature: 0.1,
                            messages: [{ role: 'user', content: fullTranslatePrompt }],
                        })
                        processedContent = fullRes.choices[0]?.message?.content ?? content
                    } else {
                        processedContent = detection.translatedText
                    }
                    steps.push(`Translated from ${detection.language} to English`)
                } else {
                    steps.push(`Detected language: ${detection.language || 'English'} (no translation needed)`)
                }
            } catch {
                steps.push('Language detection: could not parse result, keeping original')
            }
        }

        // Step 2: Detect and label speakers if not already labeled
        if (autoSpeakerDetect) {
            // Check if transcript already has clear speaker labels
            const hasLabels = /^(Interviewer|Participant|Q|A|Speaker|P\d|I|R)[\s]*:/im.test(processedContent)
            
            if (!hasLabels) {
                const speakerPrompt = `This interview transcript does NOT have clear speaker labels.
Analyze the turns of speech and add labels.

Rules:
1. Label the person asking questions as "INTERVIEWER:" 
2. Label the person answering as "PARTICIPANT:" (or use their name if mentioned)
3. Each speaker turn should start on a new line with the label
4. Preserve ALL original text exactly — only add labels at the start of each turn
5. If turns are separated by line breaks, keep them
6. Return ONLY the labeled text, nothing else

Original transcript:
${processedContent}`

                const speakerRes = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    temperature: 0.1,
                    messages: [{ role: 'user', content: speakerPrompt }],
                })

                const labeled = speakerRes.choices[0]?.message?.content
                if (labeled && labeled.length > processedContent.length * 0.7) {
                    processedContent = labeled
                    steps.push('Auto-detected and labeled speaker turns (INTERVIEWER/PARTICIPANT)')
                } else {
                    steps.push('Speaker detection: result too different from original, keeping as-is')
                }
            } else {
                steps.push('Speaker labels already present — no changes needed')
            }
        }

        return NextResponse.json({
            originalContent: content,
            processedContent,
            steps,
            wasModified: processedContent !== content,
        })
    } catch (e) {
        console.error('Preprocessing error:', e)
        return NextResponse.json({ error: 'Preprocessing failed', details: String(e) }, { status: 500 })
    }
}
