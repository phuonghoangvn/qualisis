import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { name } = body

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
        }

        const updatedUser = await prisma.user.update({
            where: { email: session.user.email },
            data: { name: name.trim() }
        })

        return NextResponse.json({ success: true, user: { name: updatedUser.name, email: updatedUser.email } })
    } catch (e) {
        console.error('Update profile error:', e)
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }
}
