import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions)
        const userId = session?.user ? (session.user as any).id : null

        // With navigator.sendBeacon, sometimes text/plain or application/json stream 
        // needs careful reading. req.text() is safest.
        const bodyText = await req.text()
        const body = JSON.parse(bodyText)
        
        const durationSeconds = body.durationSeconds

        if (typeof durationSeconds !== 'number' || durationSeconds < 3) {
            return NextResponse.json({ success: false, reason: 'Too short' })
        }

        const transcript = await prisma.transcript.findUnique({
            where: { id: params.id },
            include: { dataset: true }
        })

        if (!transcript) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        await prisma.auditLog.create({
            data: {
                projectId: transcript.dataset.projectId,
                userId,
                eventType: 'TRANSCRIPT_VIEWED',
                entityType: 'Transcript',
                entityId: params.id,
                note: `User spent ${durationSeconds} seconds reading transcript "${transcript.title}"`,
                newValue: JSON.stringify({ durationSeconds, transcriptTitle: transcript.title })
            }
        })

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error('Log view error:', e)
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}
