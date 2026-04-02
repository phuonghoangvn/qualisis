'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'

// Very simple markdown → HTML renderer (headings, bold, italic, tables, paragraphs)
function renderMarkdown(md: string): string {
    return md
        // Tables
        .replace(/^\|(.+)\|$/gm, (_, row) => {
            const cells = row.split('|').map((c: string) => c.trim())
            return '<tr>' + cells.map((c: string) => `<td>${c}</td>`).join('') + '</tr>'
        })
        .replace(/(<tr>.*<\/tr>\n?)+/g, (block) => {
            const rows = block.trim().split('\n').filter((r: string) => !r.match(/^<tr><td>[-| ]+<\/td><\/tr>$/))
            const [header, ...body] = rows
            return `<table><thead>${header.replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>')}</thead><tbody>${body.join('')}</tbody></table>`
        })
        // Headings
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Horizontal rule
        .replace(/^---$/gm, '<hr/>')
        // Bold + italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Inline code
        .replace(/`(.+?)`/g, '<code>$1</code>')
        // List items
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`)
        // Paragraphs (non-tagged lines)
        .replace(/^(?!<[a-z]).+$/gm, (line) => line.trim() ? `<p>${line}</p>` : '')
        // Clean up empty lines
        .replace(/\n{2,}/g, '\n')
}

export default function ReportPage() {
    const params = useParams()
    const projectId = params.projectId as string

    const [report, setReport] = useState<string | null>(null)
    const [generating, setGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [exportingWord, setExportingWord] = useState(false)
    const contentRef = useRef<HTMLDivElement>(null)

    // Check localStorage for cached report
    useEffect(() => {
        const cached = localStorage.getItem(`report_${projectId}`)
        if (cached) setReport(cached)
    }, [projectId])

    const generate = useCallback(async () => {
        setGenerating(true)
        setError(null)
        try {
            const res = await fetch(`/api/projects/${projectId}/report/generate`, { method: 'POST' })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Generation failed')
            }
            const data = await res.json()
            setReport(data.report)
            localStorage.setItem(`report_${projectId}`, data.report)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setGenerating(false)
        }
    }, [projectId])

    const copyMarkdown = () => {
        if (!report) return
        navigator.clipboard.writeText(report)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const exportWord = async () => {
        if (!report) return
        setExportingWord(true)
        try {
            // Build a simple HTML document and trigger download as .doc (Word-compatible)
            const htmlBody = renderMarkdown(report)
            const html = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>Research Report</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.6; margin: 2.5cm; color: #1a1a1a; }
  h1 { font-size: 18pt; color: #1e1b4b; border-bottom: 2px solid #e0e7ff; padding-bottom: 8px; }
  h2 { font-size: 14pt; color: #3730a3; margin-top: 24px; }
  h3 { font-size: 12pt; color: #4338ca; }
  p { margin: 8px 0; text-align: justify; }
  em { color: #374151; }
  strong { font-weight: bold; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th { background: #e0e7ff; padding: 6px 10px; border: 1px solid #c7d2fe; font-size: 10pt; }
  td { padding: 5px 10px; border: 1px solid #e5e7eb; font-size: 10pt; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
  code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 10pt; }
  ul { margin: 8px 0 8px 24px; }
  li { margin: 4px 0; }
</style>
</head><body>${htmlBody}</body></html>`
            const blob = new Blob([html], { type: 'application/msword' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = 'research_report.doc'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
        } finally {
            setExportingWord(false)
        }
    }

    const clearReport = () => {
        setReport(null)
        localStorage.removeItem(`report_${projectId}`)
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="flex-shrink-0 bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between">
                <div>
                    <h1 className="text-[22px] font-extrabold tracking-tight text-slate-800">⑤ Research Report</h1>
                    <p className="text-[12px] text-slate-400 font-medium mt-0.5">AI-generated thematic findings narrative from your codebook</p>
                </div>
                <div className="flex items-center gap-2">
                    {report && (
                        <>
                            <button
                                onClick={copyMarkdown}
                                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                                {copied ? 'Copied!' : 'Copy Markdown'}
                            </button>
                            <button
                                onClick={exportWord}
                                disabled={exportingWord}
                                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                {exportingWord ? 'Exporting...' : 'Export Word'}
                            </button>
                            <button
                                onClick={clearReport}
                                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all shadow-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                Clear
                            </button>
                        </>
                    )}
                    <button
                        onClick={generate}
                        disabled={generating}
                        className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-[13px] font-bold shadow-sm transition-all"
                    >
                        {generating ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                                Generating...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                {report ? 'Regenerate' : 'Generate Report'}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {error && (
                    <div className="mx-auto max-w-[800px] mt-6 px-4">
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm font-medium">
                            ⚠️ {error}
                        </div>
                    </div>
                )}

                {generating && (
                    <div className="flex flex-col items-center justify-center h-full py-32 gap-6">
                        <div className="relative w-20 h-20">
                            <div className="absolute inset-0 bg-indigo-100 rounded-2xl flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
                                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                                </svg>
                            </div>
                            <div className="absolute inset-0 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-slate-800">AI is writing your report…</p>
                            <p className="text-sm text-slate-400 mt-1">Reading your codebook and crafting thematic narratives</p>
                        </div>
                        <div className="flex flex-col gap-2 w-64">
                            {['Reading themes & codes', 'Analysing participant quotes', 'Writing narrative findings', 'Building full report'].map((step, i) => (
                                <div key={i} className="flex items-center gap-2.5 text-[12px] text-slate-500">
                                    <svg className="w-3.5 h-3.5 text-indigo-400 animate-pulse flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10"/>
                                    </svg>
                                    {step}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!generating && !report && (
                    <div className="flex flex-col items-center justify-center h-full py-32 gap-6">
                        <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100">
                            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" x2="8" y1="13" y2="13"/>
                                <line x1="16" x2="8" y1="17" y2="17"/>
                                <line x1="10" x2="8" y1="9" y2="9"/>
                            </svg>
                        </div>
                        <div className="text-center max-w-md">
                            <h2 className="text-xl font-extrabold text-slate-800 mb-2">Generate Your Research Report</h2>
                            <p className="text-sm text-slate-500 leading-relaxed mb-6">
                                AI will read your entire codebook — all themes, codes, and participant quotes — and write a structured <strong>Thematic Findings</strong> section with narrative analysis, embedded evidence, and a codebook appendix.
                            </p>
                            <div className="grid grid-cols-3 gap-4 text-left mb-8">
                                {[
                                    { icon: '📖', title: 'Narrative Findings', desc: 'Per-theme academic prose with embedded quotes' },
                                    { icon: '🔗', title: 'Cross-cutting Patterns', desc: 'Identifies themes that overlap across participants' },
                                    { icon: '📎', title: 'Codebook Appendix', desc: 'Full structured table of codes & definitions' },
                                ].map(f => (
                                    <div key={f.title} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                                        <div className="text-2xl mb-1">{f.icon}</div>
                                        <div className="text-[12px] font-bold text-slate-700 mb-0.5">{f.title}</div>
                                        <div className="text-[11px] text-slate-400">{f.desc}</div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={generate}
                                disabled={generating}
                                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[14px] font-bold shadow-md transition-all mx-auto"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                Generate Report with AI
                            </button>
                        </div>
                    </div>
                )}

                {!generating && report && (
                    <div className="max-w-[800px] mx-auto py-10 px-4">
                        {/* Paper */}
                        <div
                            ref={contentRef}
                            className="bg-white rounded-3xl shadow-[0_4px_32px_rgba(0,0,0,0.06)] border border-slate-100 px-16 py-14 prose-report"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }}
                        />
                        <p className="text-center text-[11px] text-slate-300 mt-6 font-medium">
                            Generated by QualiSIS AI · Always review before submission
                        </p>
                    </div>
                )}
            </div>

            {/* Prose styles injected globally */}
            <style>{`
                .prose-report h1 { font-size: 1.6rem; font-weight: 900; color: #1e1b4b; border-bottom: 2px solid #e0e7ff; padding-bottom: 12px; margin-bottom: 16px; line-height: 1.25; }
                .prose-report h2 { font-size: 1.15rem; font-weight: 800; color: #3730a3; margin-top: 2.5rem; margin-bottom: 0.75rem; }
                .prose-report h3 { font-size: 1rem; font-weight: 700; color: #4338ca; margin-top: 1.5rem; }
                .prose-report h4 { font-size: 0.9rem; font-weight: 700; color: #6366f1; margin-top: 1rem; }
                .prose-report p { font-size: 0.9rem; line-height: 1.8; color: #374151; margin: 0.75rem 0; text-align: justify; }
                .prose-report em { color: #1e3a5f; font-style: italic; }
                .prose-report strong { font-weight: 700; color: #1f2937; }
                .prose-report hr { border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0; }
                .prose-report ul { margin: 0.5rem 0 0.5rem 1.5rem; }
                .prose-report li { font-size: 0.875rem; color: #4b5563; margin: 0.3rem 0; line-height: 1.6; }
                .prose-report code { background: #f3f4f6; padding: 1px 5px; border-radius: 4px; font-family: monospace; font-size: 0.8rem; color: #4338ca; }
                .prose-report table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.8rem; }
                .prose-report th { background: #eef2ff; color: #3730a3; font-weight: 700; padding: 8px 12px; border: 1px solid #c7d2fe; text-align: left; }
                .prose-report td { padding: 7px 12px; border: 1px solid #e5e7eb; color: #374151; vertical-align: top; }
                .prose-report tr:nth-child(even) td { background: #f9fafb; }
            `}</style>
        </div>
    )
}
