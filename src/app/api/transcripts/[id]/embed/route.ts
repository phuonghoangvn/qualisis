import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// POST /api/transcripts/[id]/embed
// Generates text-embedding-3-small embeddings for all segments and stores them
export async function POST(
    _req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const transcriptId = params.id

        // Fetch all segments for this transcript
        const segments = await prisma.segment.findMany({
            where: { transcriptId },
            select: { id: true, text: true, speaker: true }
        })

        if (segments.length === 0) {
            return NextResponse.json({ message: 'No segments found', embedded: 0 })
        }

        // Build enriched texts (include speaker context for better semantic matching)
        const texts = segments.map(s =>
            s.speaker ? `[${s.speaker}]: ${s.text}` : s.text
        )

        // Call OpenAI Embeddings API — batch all segments in one call (very cheap)
        // text-embedding-3-small: $0.02 per 1M tokens
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: texts,
            dimensions: 1536,
        })

        // Store embeddings using raw SQL (Prisma doesn't support vector type natively)
        const updatePromises = response.data.map((item, i) => {
            const vectorStr = `[${item.embedding.join(',')}]`
            return prisma.$executeRawUnsafe(
                `UPDATE "Segment" SET embedding = $1::vector WHERE id = $2`,
                vectorStr,
                segments[i].id
            )
        })

        await Promise.all(updatePromises)

        return NextResponse.json({
            success: true,
            embedded: segments.length,
            transcriptId,
            model: 'text-embedding-3-small',
        })
    } catch (error: any) {
        console.error('Embedding error:', error)
        return NextResponse.json(
            { error: 'Failed to generate embeddings', details: error.message },
            { status: 500 }
        )
    }
}

// GET — check embedding coverage for a transcript
export async function GET(
    _req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const transcriptId = params.id
        const total = await prisma.segment.count({ where: { transcriptId } })
        const rows: any[] = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*) as count FROM "Segment"
            WHERE "transcriptId" = $1
            AND embedding IS NOT NULL
        `, transcriptId)
        const embedded = Number(rows[0]?.count ?? 0)

        return NextResponse.json({ total, embedded, coverage: total > 0 ? Math.round((embedded / total) * 100) : 0 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
