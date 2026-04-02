import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
    try {
        const { email } = await req.json()
        if (!email) return NextResponse.json({ banned: false })

        const user = await (prisma.user as any).findUnique({ where: { email }, select: { role: true } })
        if (!user) return NextResponse.json({ banned: false })

        return NextResponse.json({ banned: user.role === 'BANNED' })
    } catch {
        return NextResponse.json({ banned: false })
    }
}
