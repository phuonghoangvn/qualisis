import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/projects — list user's projects
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        const userId = session?.user ? (session.user as any).id : null

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const projects = await prisma.project.findMany({
            where: {
                members: {
                    some: { userId }
                }
            },
            include: {
                _count: { select: { datasets: true, themes: true } },
                datasets: {
                    include: {
                        _count: { select: { transcripts: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
        })
        return NextResponse.json(projects)
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }
}

// POST /api/projects — create new project  
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        const userId = session?.user ? (session.user as any).id : null

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify the user actually exists in the database (handles old/invalid JWTs)
        const userExists = await prisma.user.findUnique({ where: { id: userId } })
        if (!userExists) {
            return NextResponse.json({ error: 'Session invalid. Please sign out and sign in again.' }, { status: 401 })
        }

        const body = await req.json()
        const project = await prisma.project.create({
            data: {
                name: body.name,
                description: body.description,
                coreOntology: body.coreOntology,
                researchQuestion: body.researchQuestion,
                members: {
                    create: {
                        userId,
                        role: 'ADMIN'
                    }
                }
            }
        })
        return NextResponse.json(project, { status: 201 })
    } catch (e: any) {
        console.error('Failed to create project:', e)
        return NextResponse.json({ error: 'Failed to create project', details: e.message }, { status: 500 })
    }
}
