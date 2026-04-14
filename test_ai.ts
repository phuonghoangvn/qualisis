import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })
import { openai } from './src/lib/ai'

async function run() {
    const prompt = `RULES:
1. EXHAUSTIVE GROUPING REQUIRED: You MUST aggressively group the codes into themes. Your goal is to place EVERY SINGLE CODE into a theme if logically possible. Do not leave codes out. Create as many themes as needed to cover the data.
2. Theme name = a plain-English sentence stating the finding directly
3. Each code may appear in at most ONE theme.
4. Minimum 2 codes per theme. No upper limit on codes per theme.

UNASSIGNED CODES:
- "Code A"
- "Code B"
- "Code C"
- "Code D"
- "Code E"
- "Code F"

Return ONLY a JSON array.`

    const res = await openai!.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
    })
    
    console.log("Raw output:", res.choices[0].message.content)
}
run().catch(console.error)
