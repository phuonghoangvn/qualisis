import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/projects — list all projects
export async function GET() {
    try {
        const projects = await prisma.project.findMany({
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
        const body = await req.json()
        const project = await prisma.project.create({
            data: {
                name: body.name,
                description: body.description,
                coreOntology: body.coreOntology,
                researchQuestion: body.researchQuestion,
            }
        })
        return NextResponse.json(project, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
    }
}
