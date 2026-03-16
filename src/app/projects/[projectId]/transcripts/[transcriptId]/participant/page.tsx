import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import ParticipantWorkspace from '@/components/ParticipantWorkspace'

export default async function ParticipantPage({
    params,
}: {
    params: { projectId: string; transcriptId: string }
}) {
    const transcript = await prisma.transcript.findUnique({
        where: { id: params.transcriptId },
    })

    if (!transcript) notFound()

    return <ParticipantWorkspace transcript={transcript as any} projectId={params.projectId} />
}
