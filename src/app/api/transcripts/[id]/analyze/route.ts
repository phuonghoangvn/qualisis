export const maxDuration = 60; // Max allowed for Vercel Hobby
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
    analyzeWithGPT,
    analyzeWithClaude,
    analyzeWithGemini,
    mergeAndComputeConsensus,
    generateTranscriptSummary
} from '@/lib/ai'
import { calculateConfidenceScoresComplex } from '@/lib/score'
import { autoCleanHighlights } from '@/lib/clean'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/transcripts/[id]/analyze
// Calls all 3 AI models in parallel, merges results, saves to DB
export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const body = await req.json().catch(() => ({}))
        const { models = ['gpt', 'claude', 'gemini'], researchContext } = body

        const session = await getServerSession(authOptions)
        const userId = session?.user ? (session.user as any).id : null

        // Fetch transcript
        const transcript = await prisma.transcript.findUnique({
            where: { id: params.id },
            include: { dataset: { include: { project: true } } }
        })
        if (!transcript) {
            return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
        }

        // Mark as analyzing + record start time
        const analysisStartTime = Date.now()
        await prisma.transcript.update({
            where: { id: params.id },
            data: { status: 'ANALYZING' }
        })

        // Generate summary first before analysis
        const summary = await generateTranscriptSummary(transcript.content);
        const metadataRaw = typeof transcript.metadata === 'string' ? JSON.parse(transcript.metadata) : (transcript.metadata || {});

        // Combine UI-provided researchContext with Global Project Context
        const project = transcript.dataset.project;
        const projectContextPieces = [];
        if (project.description) projectContextPieces.push(`Project Description: ${project.description}`);
        if (project.researchQuestion) projectContextPieces.push(`Research Question: ${project.researchQuestion}`);
        if (project.coreOntology) projectContextPieces.push(`Core Ontology / Known Concepts: ${project.coreOntology}`);
        
        // Read AI Settings from project (cast to any to handle stale TS IDE cache)
        const projectAny = project as any;
        const aiSettings = (projectAny.aiSettings && typeof projectAny.aiSettings === 'object' ? projectAny.aiSettings : {}) as any;
        const defaultModel = aiSettings.defaultModel || 'gpt-4o-mini';
        const scoringModel = aiSettings.scoringModel || 'gpt-4o-mini';

        const combinedProjectContext = projectContextPieces.join('\n');
        const finalResearchContext = [
            combinedProjectContext ? `[GLOBAL PROJECT CONTEXT]\n${combinedProjectContext}\n` : '',
            researchContext ? `[SPECIFIC INSTRUCTIONS FOR THIS RUN]\n${researchContext}` : ''
        ].filter(Boolean).join('\n') || 'Focus on identifying statements made by participants about their experiences, feelings, and perceptions.';

        // Call selected AI models in parallel
        const [gptResult, claudeResult, geminiResult] = await Promise.allSettled([
            models.includes('gpt') ? analyzeWithGPT(transcript.content, finalResearchContext, metadataRaw, summary, defaultModel) : Promise.resolve(null),
            models.includes('claude') ? analyzeWithClaude(transcript.content, finalResearchContext, metadataRaw, summary) : Promise.resolve(null),
            models.includes('gemini') ? analyzeWithGemini(transcript.content, finalResearchContext, metadataRaw, summary) : Promise.resolve(null),
        ])

        const results = [
            gptResult.status === 'fulfilled' ? gptResult.value : null,
            claudeResult.status === 'fulfilled' ? claudeResult.value : null,
            geminiResult.status === 'fulfilled' ? geminiResult.value : null,
        ]

        // Merge results and compute consensus
        const mergedSegments = mergeAndComputeConsensus(results)

        if (mergedSegments.length === 0) {
            await prisma.transcript.update({
                where: { id: params.id },
                data: { status: 'DRAFT' }
            })
            return NextResponse.json({ error: 'No AI results — check your API keys in .env' }, { status: 422 })
        }

        // Delete existing auto-generated suggestions (keep human ones via codeAssignments)
        const segmentsWithoutCodes = await prisma.segment.findMany({
            where: { 
                transcriptId: params.id,
                codeAssignments: { none: {} }
            },
            select: { id: true }
        })
        
        if (segmentsWithoutCodes.length > 0) {
            await prisma.segment.deleteMany({
                where: { id: { in: segmentsWithoutCodes.map(s => s.id) } }
            })
        }

        // Delete any unaccepted AI suggestions for the remaining segments
        const remainingSegments = await prisma.segment.findMany({
            where: { transcriptId: params.id },
            select: { id: true }
        })
        if (remainingSegments.length > 0) {
            await prisma.aISuggestion.deleteMany({
                where: { 
                    segmentId: { in: remainingSegments.map(s => s.id) },
                    status: { notIn: ['APPROVED', 'MODIFIED'] }
                }
            })
        }

        // Save merged segments + suggestions to DB in batches to avoid both Vercel timeout and Neon DB exhaustion
        const savedSegments = []
        const BATCH_SIZE = 4; // 4 segments * ~3 models = 12 concurrent DB/API ops

        // Load all protected (human-coded or accepted) segments to avoid overlap
        const protectedSegments = await prisma.segment.findMany({
            where: { transcriptId: params.id },
            select: { startIndex: true, endIndex: true }
        })

        const isOverlappingProtected = (start: number, end: number) =>
            protectedSegments.some(p => start < p.endIndex && end > p.startIndex)

        for (let i = 0; i < mergedSegments.length; i += BATCH_SIZE) {
            const batch = mergedSegments.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (seg, batchIdx) => {
                // Skip AI segment if it overlaps with any existing human/approved segment
                if (isOverlappingProtected(seg.startIndex, seg.endIndex)) return;

                const segment = await prisma.segment.create({
                    data: {
                        transcriptId: params.id,
                        text: seg.text,
                        startIndex: seg.startIndex,
                        endIndex: seg.endIndex,
                        order: i + batchIdx,
                    }
                });

                // Can do Promise.all for suggestions too since models are independent (max 3 models)
                await Promise.all(Object.entries(seg.models).map(async ([modelName, modelData]) => {
                    const scoring = await calculateConfidenceScoresComplex(seg.text, modelData.label, scoringModel);
                    const scoringWithMeta = {
                        ...scoring,
                        theme: modelData.theme || seg.consensusTheme || null,
                        sentiment: modelData.sentiment || null,
                    };
                    
                    await prisma.aISuggestion.create({
                        data: {
                            segmentId: segment.id,
                            label: modelData.label,
                            explanation: modelData.explanation,
                            confidence: scoringWithMeta.labelConf,
                            alternatives: modelData.alternatives || [],
                            uncertainty: JSON.stringify(scoringWithMeta),
                            modelProvider: modelName,
                            promptVersion: researchContext || 'Empty prompt',
                            status: 'SUGGESTED',
                        }
                    });
                }));

                savedSegments.push(segment);
            }));
        }

        // Mark transcript as reviewed (analysis done)
        await prisma.transcript.update({
            where: { id: params.id },
            data: { status: 'REVIEWING' }
        })

        const durationMs = Date.now() - analysisStartTime
        const projectId = transcript.dataset.projectId

        // Log audit event with timing, model, project, user
        await prisma.auditLog.create({
            data: {
                projectId,
                userId,
                eventType: 'AI_ANALYSIS_COMPLETE',
                entityType: 'Transcript',
                entityId: params.id,
                newValue: JSON.stringify({
                    transcriptTitle: transcript.title,
                    modelsUsed: results.filter(Boolean).map(r => r!.model),
                    segmentsFound: savedSegments.length,
                    durationMs,
                    durationLabel: `${Math.round(durationMs / 1000)}s`,
                    defaultModel,
                    scoringModel,
                }),
            }
        })

        // Auto clean the highlights using contextual intel
        const droppedCount = await autoCleanHighlights(params.id)

        // Log auto-clean result
        if (droppedCount > 0) {
            await prisma.auditLog.create({
                data: {
                    projectId,
                    eventType: 'AUTO_CLEAN_COMPLETE',
                    entityType: 'Transcript',
                    entityId: params.id,
                    note: `Auto-clean removed ${droppedCount} low-quality highlight(s) from "${transcript.title}"`,
                    newValue: JSON.stringify({ droppedCount, transcriptTitle: transcript.title })
                }
            })
        }

        const { revalidatePath } = require('next/cache')
        revalidatePath(`/projects/${transcript.dataset.projectId}/transcripts/${transcript.id}`)

        return NextResponse.json({
            success: true,
            segmentsFound: savedSegments.length - droppedCount,
            modelsUsed: results.filter(Boolean).map(r => r!.model),
            droppedCount
        })

    } catch (e) {
        console.error('Analysis error:', e)
        await prisma.transcript.update({
            where: { id: params.id },
            data: { status: 'DRAFT' }
        }).catch(() => {})
        return NextResponse.json({ error: 'Analysis failed', details: String(e) }, { status: 500 })
    }
}
