import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        await prisma.segment.delete({
            where: { id: params.id },
        })

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error('Delete segment error', e)
        return NextResponse.json({ error: 'Failed to delete segment' }, { status: 500 })
    }
}
