import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PATCH(
    request: Request,
    { params }: { params: { projectId: string; transcriptId: string } }
) {
    try {
        const body = await request.json()
        const { metadata } = body

        if (metadata) {
            await prisma.transcript.update({
                where: { id: params.transcriptId },
                data: { metadata }
            })
        }

        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
