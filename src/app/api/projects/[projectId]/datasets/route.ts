import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const maxDuration = 60;

export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const body = await req.json()
        const { datasetName, files } = body

        if (!datasetName || !files || files.length === 0) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Verify project exists
        const project = await prisma.project.findUnique({
            where: { id: params.projectId }
        })
        if (!project) {
            return NextResponse.json({ error: 'Project not found or was deleted' }, { status: 404 })
        }

        // Create dataset
        const dataset = await prisma.dataset.create({
            data: {
                name: datasetName,
                projectId: params.projectId,
                description: `Uploaded on ${new Date().toLocaleDateString()}`,
            }
        })

        // Create transcripts in dataset
        const transcripts = await Promise.all(
            files.map((file: { title: string; content: string; metadata?: any }) => 
                prisma.transcript.create({
                    data: {
                        datasetId: dataset.id,
                        title: file.title,
                        content: file.content,
                        metadata: file.metadata || null,
                        status: 'DRAFT'
                    }
                })
            )
        )

        return NextResponse.json({ dataset, transcripts }, { status: 201 })
    } catch (e) {
        console.error('Upload Error:', e)
        return NextResponse.json({ error: 'Failed to upload dataset' }, { status: 500 })
    }
}
