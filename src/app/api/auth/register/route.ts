import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
    try {
        const { name, email, password } = await req.json()

        if (!email || !password || !name) {
            return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        })

        if (existingUser) {
            return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
        }

        const bcrypt = require('bcryptjs')
        const hashedPassword = await bcrypt.hash(password, 10)

        // Create user with BANNED role by default — requires admin approval
        const user = await (prisma.user as any).create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: 'BANNED',
            }
        })

        return NextResponse.json({ 
            pending: true, 
            message: 'Your account has been created and is awaiting approval. Please contact hoangnnp01@gmail.com to request access.',
            user: { id: user.id, email: user.email, name: user.name } 
        }, { status: 201 })
    } catch (error: any) {
        console.error('Registration error:', error)
        return NextResponse.json({ error: 'Failed to register account: ' + (error?.message || String(error)) }, { status: 500 })
    }
}
