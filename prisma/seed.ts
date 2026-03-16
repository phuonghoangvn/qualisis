import { PrismaClient, UserRole, ReviewStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding demo data...')

    // 1. Create Users
    const researcher = await prisma.user.upsert({
        where: { email: 'demo@example.com' },
        update: {},
        create: {
            email: 'demo@example.com',
            name: 'Dr. Jane Smith',
            role: UserRole.RESEARCHER,
        },
    })

    // 2. Create Project
    const project = await prisma.project.create({
        data: {
            name: 'Teacher Job Satisfaction Study',
            description: 'A qualitative analysis of emotional burnout and coping mechanisms among high school teachers.',
            members: {
                create: {
                    userId: researcher.id,
                    role: UserRole.ADMIN
                }
            }
        }
    })

    // 3. Create Dataset
    const dataset = await prisma.dataset.create({
        data: {
            projectId: project.id,
            name: 'Round 1 Interviews',
            description: 'Initial interviews with 5 participants.'
        }
    })

    // 4. Create Transcript & Segments
    const transcriptText = `Interviewer: Thank you for speaking with me today. Could you tell me about a time recently when you felt particularly overwhelmed?
Participant: Well, last Tuesday was a nightmare. I had three students absent who needed makeup packets, my principal asked for the quarter grades early, and then during my prep period, a parent called to complain about a B minus. I just felt this deep sense of exhaustion where my chest gets tight. It's like no matter how much I prep, the expectations just keep shifting.
Interviewer: How did you handle that feeling in the moment?
Participant: Honestly, I went to my car during lunch and just sat in silence for 15 minutes. It's the only place where no one needs anything from me. You learn these little micro-coping strategies to survive till Friday.`;

    const transcript = await prisma.transcript.create({
        data: {
            datasetId: dataset.id,
            title: 'P1 - High School Math Teacher',
            content: transcriptText,
            status: 'ANALYZING',
            segments: {
                create: [
                    {
                        text: "Well, last Tuesday was a nightmare. I had three students absent who needed makeup packets, my principal asked for the quarter grades early, and then during my prep period, a parent called to complain about a B minus.",
                        startIndex: 111,
                        endIndex: 334,
                        speaker: 'Participant',
                        order: 1
                    },
                    {
                        text: "I just felt this deep sense of exhaustion where my chest gets tight.",
                        startIndex: 335,
                        endIndex: 404,
                        speaker: 'Participant',
                        order: 2
                    },
                    {
                        text: "It's like no matter how much I prep, the expectations just keep shifting.",
                        startIndex: 405,
                        endIndex: 479,
                        speaker: 'Participant',
                        order: 3
                    },
                    {
                        text: "Honestly, I went to my car during lunch and just sat in silence for 15 minutes. It's the only place where no one needs anything from me.",
                        startIndex: 539,
                        endIndex: 676,
                        speaker: 'Participant',
                        order: 4
                    },
                    {
                        text: "You learn these little micro-coping strategies to survive till Friday.",
                        startIndex: 677,
                        endIndex: 746,
                        speaker: 'Participant',
                        order: 5
                    }
                ]
            }
        },
        include: { segments: true }
    })

    // 5. Create AI Suggestions
    // Segment indices:
    // 1: Admin Overhead
    // 2: Physical symptoms of burnout
    // 3: Unrealistic expectations
    // 4: Isolation as coping
    // 5: Micro-coping
    const segments = transcript.segments.sort((a, b) => a.order - b.order)

    await prisma.aISuggestion.create({
        data: {
            segmentId: segments[1].id,
            label: 'Somatic Experiencing of Burnout',
            explanation: 'The participant explicitly links emotional exhaustion to a physical sensation ("chest gets tight"), indicating somatic symptoms of occupational stress.',
            confidence: 'HIGH',
            alternatives: ['Emotional Exhaustion', 'Physical Stress Symptoms'],
            uncertainty: 'The phrase "deep sense of exhaustion" is clear, but "chest gets tight" could also relate to anxiety or panic. Proceed with somatic code.',
            promptVersion: 'v1.4-qual-coder',
            modelProvider: 'GPT-4-Turbo',
            status: ReviewStatus.SUGGESTED,
            evidenceSpans: {
                create: [
                    { exactQuote: 'deep sense of exhaustion', startIndex: 347, endIndex: 370 },
                    { exactQuote: 'chest gets tight', startIndex: 382, endIndex: 397 }
                ]
            }
        }
    })

    await prisma.aISuggestion.create({
        data: {
            segmentId: segments[3].id,
            label: 'Isolation as Coping Mechanism',
            explanation: 'Seeking a physical boundary ("car") and sensory deprivation ("silence") to escape professional demands ("no one needs anything").',
            confidence: 'HIGH',
            alternatives: ['Boundary Setting', 'Avoidance Behavior'],
            uncertainty: 'None detected. Strong indicator of withdrawal as coping.',
            promptVersion: 'v1.4-qual-coder',
            modelProvider: 'GPT-4-Turbo',
            status: ReviewStatus.SUGGESTED,
            evidenceSpans: {
                create: [
                    { exactQuote: 'sat in silence for 15 minutes', startIndex: 588, endIndex: 616 },
                    { exactQuote: 'only place where no one needs anything from me', startIndex: 630, endIndex: 675 }
                ]
            }
        }
    })

    // 6. Create some raw codebook entries
    await prisma.codebookEntry.create({
        data: {
            projectId: project.id,
            name: 'Administrative Burden',
            definition: 'Mentions of paperwork, grading demands, or principal requests outside of teaching hours.',
            type: 'RAW',
            examplesIn: '"principal asked for the quarter grades early"',
            examplesOut: '"students were acting out"',
        }
    })

    console.log('Seeding complete.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
