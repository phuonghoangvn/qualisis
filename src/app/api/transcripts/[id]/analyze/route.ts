import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
    analyzeWithGPT,
    analyzeWithClaude,
    analyzeWithGemini,
    mergeAndComputeConsensus,
    generateTranscriptSummary,
    clusterThematicCodesWithClaude
} from '@/lib/ai'
import { calculateConfidenceScoresComplex } from '@/lib/score'
import { autoCleanHighlights } from '@/lib/clean'

// POST /api/transcripts/[id]/analyze
// Calls all 3 AI models in parallel, merges results, saves to DB
export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const body = await req.json().catch(() => ({}))
        const { models = ['gpt', 'claude', 'gemini'], researchContext } = body

        // Fetch transcript
        const transcript = await prisma.transcript.findUnique({
            where: { id: params.id },
            include: { dataset: { include: { project: true } } }
        })
        if (!transcript) {
            return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
        }

        // Mark as analyzing
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
        
        const combinedProjectContext = projectContextPieces.join('\n');
        const finalResearchContext = [
            combinedProjectContext ? `[GLOBAL PROJECT CONTEXT]\n${combinedProjectContext}\n` : '',
            researchContext ? `[SPECIFIC INSTRUCTIONS FOR THIS RUN]\n${researchContext}` : ''
        ].filter(Boolean).join('\n') || 'Focus on identifying statements made by participants about their experiences, feelings, and perceptions.';

        // Call selected AI models in parallel
        const [gptResult, claudeResult, geminiResult] = await Promise.allSettled([
            models.includes('gpt') ? analyzeWithGPT(transcript.content, finalResearchContext, metadataRaw, summary) : Promise.resolve(null),
            models.includes('claude') ? analyzeWithClaude(transcript.content, finalResearchContext, metadataRaw, summary) : Promise.resolve(null),
            models.includes('gemini') ? analyzeWithGemini(transcript.content, finalResearchContext, metadataRaw, summary) : Promise.resolve(null),
        ])

        const results = [
            gptResult.status === 'fulfilled' ? gptResult.value : null,
            claudeResult.status === 'fulfilled' ? claudeResult.value : null,
            geminiResult.status === 'fulfilled' ? geminiResult.value : null,
        ]

        // --- CLUSTER SEMANTIC CODES BEFORE MERGING ---
        try {
            const allUniqueLabels = new Set<string>();
            results.forEach(r => {
                if (r) {
                    r.suggestions.forEach((s: any) => {
                        if (s.label) allUniqueLabels.add(s.label);
                    });
                }
            });

            const uniqueLabelsArray = Array.from(allUniqueLabels);
            if (uniqueLabelsArray.length > 0) {
                const clusterMap = await clusterThematicCodesWithClaude(uniqueLabelsArray);
                if (clusterMap) {
                    results.forEach(r => {
                        if (r) {
                            r.suggestions.forEach((s: any) => {
                                if (s.label && clusterMap[s.label]) {
                                    s.label = clusterMap[s.label];
                                }
                            });
                        }
                    });
                }
            }
        } catch (clusterError) {
            console.error("Semantic clustering failed, continuing with raw codes", clusterError);
        }
        // ------------------------------------------------

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
        const existingSegments = await prisma.segment.findMany({
            where: { transcriptId: params.id },
            select: { id: true }
        })
        if (existingSegments.length > 0) {
            await prisma.aISuggestion.deleteMany({
                where: { segmentId: { in: existingSegments.map(s => s.id) } }
            })
            await prisma.segment.deleteMany({
                where: { transcriptId: params.id }
            })
        }

        // Save merged segments + suggestions to DB sequentially to avoid Neon DB timeout
        const savedSegments = []
        for (let idx = 0; idx < mergedSegments.length; idx++) {
            const seg = mergedSegments[idx]
            const segment = await prisma.segment.create({
                data: {
                    transcriptId: params.id,
                    text: seg.text,
                    startIndex: seg.startIndex,
                    endIndex: seg.endIndex,
                    order: idx,
                }
            })

            // Iterate sequentially
            for (const [modelName, modelData] of Object.entries(seg.models)) {
                const scoring = await calculateConfidenceScoresComplex(seg.text, modelData.label);
                
                await prisma.aISuggestion.create({
                    data: {
                        segmentId: segment.id,
                        label: modelData.label,
                        explanation: modelData.explanation,
                        confidence: scoring.labelConf,
                        alternatives: modelData.alternatives,
                        uncertainty: JSON.stringify(scoring),
                        modelProvider: modelName,
                        promptVersion: researchContext || 'Empty prompt',
                        status: 'SUGGESTED',
                    }
                })
            }
            savedSegments.push(segment)
        }

        // Mark transcript as reviewed (analysis done)
        await prisma.transcript.update({
            where: { id: params.id },
            data: { status: 'REVIEWING' }
        })

        // Log audit event
        await prisma.auditLog.create({
            data: {
                eventType: 'AI_ANALYSIS_COMPLETE',
                entityType: 'Transcript',
                entityId: params.id,
                newValue: JSON.stringify({
                    modelsUsed: results.filter(Boolean).map(r => r!.model),
                    segmentsFound: savedSegments.length,
                }),
            }
        })

        // Auto clean the highlights using contextual intel
        const droppedCount = await autoCleanHighlights(params.id)

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
