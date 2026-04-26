/**
 * One-time backfill script: generates embeddings for all existing segments
 * Run: npx tsx scripts/backfill-embeddings.ts
 */

import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'

const prisma = new PrismaClient()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const BATCH_SIZE = 100 // OpenAI supports up to 2048 inputs per call

async function main() {
    console.log('🔍 Finding segments without embeddings...')

    const segments = await prisma.$queryRawUnsafe<{ id: string; text: string; speaker: string | null }[]>(`
        SELECT id, text, speaker FROM "Segment"
        WHERE embedding IS NULL
        ORDER BY "transcriptId", "order"
    `)

    console.log(`📊 Found ${segments.length} segments to embed`)

    if (segments.length === 0) {
        console.log('✅ All segments already have embeddings!')
        return
    }

    let processed = 0
    let batches = Math.ceil(segments.length / BATCH_SIZE)

    for (let i = 0; i < segments.length; i += BATCH_SIZE) {
        const batch = segments.slice(i, i + BATCH_SIZE)
        const batchNum = Math.floor(i / BATCH_SIZE) + 1

        console.log(`\n⚙️  Batch ${batchNum}/${batches} (${batch.length} segments)...`)

        const texts = batch.map(s => s.speaker ? `[${s.speaker}]: ${s.text}` : s.text)

        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: texts,
            dimensions: 1536,
        })

        const updatePromises = response.data.map((item, j) => {
            const vectorStr = `[${item.embedding.join(',')}]`
            return prisma.$executeRawUnsafe(
                `UPDATE "Segment" SET embedding = $1::vector WHERE id = $2`,
                vectorStr,
                batch[j].id
            )
        })

        await Promise.all(updatePromises)
        processed += batch.length
        console.log(`   ✅ ${processed}/${segments.length} done`)

        // Small delay between batches to be kind to the API
        if (i + BATCH_SIZE < segments.length) {
            await new Promise(r => setTimeout(r, 200))
        }
    }

    console.log(`\n🎉 Done! Embedded ${processed} segments.`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
