'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'

type ThemeData = {
    id: string
    name: string
    description: string | null
    status: string
    codeLinks: {
        codebookEntry: {
            id: string
            name: string
            type: string
        }
    }[]
}

type ReportSection = {
    id: string
    type: string
    title: string
    content: string
    themeId: string | null
    theme: { id: string; name: string; status: string } | null
    createdAt: string
    updatedAt: string
}

// ── Default Prompts ──────────────────────────────────────────────────────────
const DEFAULT_SUMMARY_PROMPT = `Write a thematic summary for the given theme.

RULES:
- Write 2-4 paragraphs that synthesize the codes and quotes into a coherent narrative
- Every claim MUST be grounded in the evidence — cite using [Q1], [Q2] etc.
- Do NOT invent any quotes or data points not present in the data
- Use academic qualitative research register
- Start with a topic sentence that captures the theme's essence
- End with a brief interpretive comment on what this theme reveals

Return ONLY the text content, no markdown headers.`

const DEFAULT_FINDING_PROMPT = `Write the "Findings & Interpretation" section.

Write 2-4 paragraphs that:
1. Identify the overarching narrative that connects all themes
2. Highlight notable relationships (contradictions, reinforcements, or tensions between themes)
3. Discuss how these findings address the research question
4. Situate the findings within the broader context

RULES:
- Ground every interpretation in the named themes
- Do NOT hallucinate codes, quotes, or themes not listed
- Use academic qualitative research register
- Be interpretive but evidence-grounded

Return ONLY the text content, no markdown headers.`

const DEFAULT_RECOMMENDATION_PROMPT = `Write practical recommendations and implications (3-6 bullet points) that:
1. Are directly derived from the themes and evidence
2. Address different stakeholder groups where appropriate
3. Include both immediate actionable steps and longer-term considerations
4. Connect back to the research question

RULES:
- Each recommendation must be traceable to at least one theme
- Format as structured points with stakeholder labels (e.g. "For Policy:", "For Practice:")
- Be specific and actionable, not vague
- Use academic qualitative research register

Return ONLY the text content, no markdown headers.`

export default function ReportPage() {
    const { projectId } = useParams()
    const [activeTab, setActiveTab] = useState('Thematic Summaries')
    const [sections, setSections] = useState<ReportSection[]>([])
    const [themes, setThemes] = useState<ThemeData[]>([])
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')
    const [generatingId, setGeneratingId] = useState<string | null>(null)
    const [chatInput, setChatInput] = useState('')
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
        { role: 'ai', text: 'Hi! I can help you draft report sections. I\'m constrained to only use your approved themes, codes, and quotes. Ask me to draft a summary, interpret findings, or suggest recommendations.' }
    ])

    // Prompt states
    const [summaryPrompt, setSummaryPrompt] = useState(DEFAULT_SUMMARY_PROMPT)
    const [findingPrompt, setFindingPrompt] = useState(DEFAULT_FINDING_PROMPT)
    const [recommendationPrompt, setRecommendationPrompt] = useState(DEFAULT_RECOMMENDATION_PROMPT)
    const [showPromptEditor, setShowPromptEditor] = useState<string | null>(null)

    // Adding blank section
    const [addingBlank, setAddingBlank] = useState(false)
    const [blankTitle, setBlankTitle] = useState('')
    const [blankContent, setBlankContent] = useState('')

    const fetchData = useCallback(async () => {
        const [sectionsRes, themesRes] = await Promise.all([
            fetch(`/api/projects/${projectId}/report`),
            fetch(`/api/projects/${projectId}/themes`)
        ])
        const [sectionsData, themesData] = await Promise.all([
            sectionsRes.json(),
            themesRes.json()
        ])
        setSections(Array.isArray(sectionsData) ? sectionsData : [])
        setThemes(Array.isArray(themesData) ? themesData : [])
    }, [projectId])

    useEffect(() => { fetchData() }, [fetchData])

    // Filter sections by tab
    const tabTypeMap: Record<string, string> = {
        'Thematic Summaries': 'THEMATIC_SUMMARY',
        'Findings': 'FINDING',
        'Recommendations': 'RECOMMENDATION',
    }
    const currentType = tabTypeMap[activeTab]
    const currentSections = sections.filter(s => s.type === currentType)

    // Check which themes have summaries already
    const themesWithSummaries = new Set(
        sections.filter(s => s.type === 'THEMATIC_SUMMARY').map(s => s.themeId)
    )
    const themesWithoutSummaries = themes.filter(t => !themesWithSummaries.has(t.id))

    // Get current prompt based on type
    const getCurrentPrompt = (type: string) => {
        switch (type) {
            case 'THEMATIC_SUMMARY': return summaryPrompt
            case 'FINDING': return findingPrompt
            case 'RECOMMENDATION': return recommendationPrompt
            default: return ''
        }
    }

    const getDefaultPrompt = (type: string) => {
        switch (type) {
            case 'THEMATIC_SUMMARY': return DEFAULT_SUMMARY_PROMPT
            case 'FINDING': return DEFAULT_FINDING_PROMPT
            case 'RECOMMENDATION': return DEFAULT_RECOMMENDATION_PROMPT
            default: return ''
        }
    }

    const setCurrentPrompt = (type: string, value: string) => {
        switch (type) {
            case 'THEMATIC_SUMMARY': setSummaryPrompt(value); break
            case 'FINDING': setFindingPrompt(value); break
            case 'RECOMMENDATION': setRecommendationPrompt(value); break
        }
    }

    // Generate AI draft
    const generateDraft = async (type: string, themeId?: string) => {
        const genKey = themeId || type
        setGeneratingId(genKey)
        try {
            const res = await fetch(`/api/projects/${projectId}/report/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, themeId, customPrompt: getCurrentPrompt(type) })
            })
            const data = await res.json()
            if (data.content) {
                // Create section in DB
                await fetch(`/api/projects/${projectId}/report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type,
                        title: data.title,
                        content: data.content,
                        themeId: themeId || null
                    })
                })
                fetchData()
            }
        } catch (e) {
            console.error('Failed to generate draft:', e)
        } finally {
            setGeneratingId(null)
        }
    }

    // Add blank section
    const addBlankSection = async (type: string) => {
        if (!blankTitle.trim()) return
        try {
            await fetch(`/api/projects/${projectId}/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    title: blankTitle.trim(),
                    content: blankContent || '',
                    themeId: null
                })
            })
            setAddingBlank(false)
            setBlankTitle('')
            setBlankContent('')
            fetchData()
        } catch (e) {
            console.error('Failed to add blank section:', e)
        }
    }

    // Save edit
    const saveEdit = async (sectionId: string) => {
        await fetch(`/api/projects/${projectId}/report/${sectionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: editContent })
        })
        setEditingId(null)
        setEditContent('')
        fetchData()
    }

    // Delete section
    const deleteSection = async (sectionId: string) => {
        if (!confirm('Delete this section?')) return
        await fetch(`/api/projects/${projectId}/report/${sectionId}`, { method: 'DELETE' })
        fetchData()
    }

    // Chat handler
    const handleChat = async () => {
        if (!chatInput.trim()) return
        const msg = chatInput.trim()
        setChatInput('')
        setChatMessages(prev => [...prev, { role: 'user', text: msg }])

        // Determine type from message
        let type = 'THEMATIC_SUMMARY'
        if (msg.toLowerCase().includes('finding') || msg.toLowerCase().includes('interpret')) type = 'FINDING'
        else if (msg.toLowerCase().includes('recommend') || msg.toLowerCase().includes('implicat')) type = 'RECOMMENDATION'

        let themeId: string | undefined
        if (type === 'THEMATIC_SUMMARY') {
            // Try to find theme mention
            const matched = themes.find(t => msg.toLowerCase().includes(t.name.toLowerCase()))
            if (matched) themeId = matched.id
            else if (themesWithoutSummaries.length > 0) themeId = themesWithoutSummaries[0].id
        }

        setChatMessages(prev => [...prev, { role: 'ai', text: '⏳ Generating grounded draft...' }])

        try {
            const res = await fetch(`/api/projects/${projectId}/report/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, themeId, customPrompt: getCurrentPrompt(type) })
            })
            const data = await res.json()
            if (data.content) {
                setChatMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = { role: 'ai', text: data.content }
                    return updated
                })
                // Save to DB
                await fetch(`/api/projects/${projectId}/report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type,
                        title: data.title,
                        content: data.content,
                        themeId: themeId || null
                    })
                })
                fetchData()
            } else {
                setChatMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = { role: 'ai', text: data.error || 'Could not generate draft. Ensure you have themes set up.' }
                    return updated
                })
            }
        } catch {
            setChatMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'ai', text: 'An error occurred. Please try again.' }
                return updated
            })
        }
    }

    const totalCodes = themes.reduce((acc, t) => acc + (t.codeLinks?.length || 0), 0)

    // Render section card
    const renderSectionCard = (section: ReportSection, idx?: number) => (
        <div key={section.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {idx !== undefined && (
                        <span className="text-xs font-extrabold text-indigo-500 bg-indigo-50 w-7 h-7 rounded-lg flex items-center justify-center">{idx + 1}</span>
                    )}
                    <div>
                        <h3 className="text-[15px] font-extrabold text-slate-800">{section.title}</h3>
                        {section.theme && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide mt-0.5 inline-block ${section.theme.status === 'REVIEWED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                {section.theme.status}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => { setEditingId(section.id); setEditContent(section.content) }}
                        className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 w-7 h-7 flex items-center justify-center rounded-md transition-colors"
                        title="Edit"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z"/></svg>
                    </button>
                    <button
                        onClick={() => deleteSection(section.id)}
                        className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 w-7 h-7 flex items-center justify-center rounded-md transition-colors"
                        title="Delete"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                    <button
                        onClick={() => generateDraft(section.type, section.themeId || undefined)}
                        disabled={!!generatingId}
                        className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 w-7 h-7 flex items-center justify-center rounded-md transition-colors"
                        title="Regenerate"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                    </button>
                </div>
            </div>
            <div className="px-6 py-5">
                {editingId === section.id ? (
                    <div className="space-y-3">
                        <textarea
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            className="w-full min-h-[200px] p-4 border border-slate-200 rounded-xl text-[13px] leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 resize-y"
                        />
                        <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => { setEditingId(null); setEditContent('') }} className="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg transition-colors">Cancel</button>
                            <button onClick={() => saveEdit(section.id)} className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-lg shadow-sm transition-colors">Save</button>
                        </div>
                    </div>
                ) : (
                    <div className="text-[13px] leading-[1.85] text-slate-600 whitespace-pre-line prose prose-sm max-w-none">
                        {section.content}
                    </div>
                )}
            </div>
        </div>
    )

    // Prompt Editor Component
    const renderPromptEditor = (type: string, label: string) => {
        const isOpen = showPromptEditor === type
        const currentVal = getCurrentPrompt(type)
        const defaultVal = getDefaultPrompt(type)
        const isModified = currentVal !== defaultVal

        return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                <button
                    onClick={() => setShowPromptEditor(isOpen ? null : type)}
                    className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-2.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span className="text-xs font-bold text-slate-600">{label} Prompt</span>
                        {isModified && (
                            <span className="text-[9px] font-extrabold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded uppercase">Modified</span>
                        )}
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
                </button>
                {isOpen && (
                    <div className="px-5 pb-4 border-t border-slate-100">
                        <div className="flex items-center justify-between mt-3 mb-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Generation Instructions</p>
                            {isModified && (
                                <button
                                    onClick={() => setCurrentPrompt(type, defaultVal)}
                                    className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors flex items-center gap-1"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                                    Reset to Default
                                </button>
                            )}
                        </div>
                        <textarea
                            value={currentVal}
                            onChange={e => setCurrentPrompt(type, e.target.value)}
                            className="w-full h-48 text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 resize-y font-mono leading-relaxed custom-scrollbar bg-slate-50"
                        />
                        <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                            This prompt will be used when generating AI drafts. Your themes and evidence data will be injected automatically.
                        </p>
                    </div>
                )}
            </div>
        )
    }

    // Add Blank inline form
    const renderAddBlankForm = (type: string) => {
        if (!addingBlank) return null
        return (
            <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    <h4 className="text-sm font-extrabold text-slate-800">Add New {activeTab === 'Findings' ? 'Finding' : activeTab === 'Recommendations' ? 'Recommendation' : 'Summary'}</h4>
                </div>
                <input
                    autoFocus
                    value={blankTitle}
                    onChange={e => setBlankTitle(e.target.value)}
                    placeholder="Enter title..."
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                />
                <textarea
                    value={blankContent}
                    onChange={e => setBlankContent(e.target.value)}
                    placeholder="Write your content here (optional, you can add later)..."
                    className="w-full min-h-[120px] p-4 border border-slate-200 rounded-lg text-[13px] leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 resize-y"
                />
                <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => { setAddingBlank(false); setBlankTitle(''); setBlankContent('') }} className="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg transition-colors">Cancel</button>
                    <button
                        onClick={() => addBlankSection(type)}
                        disabled={!blankTitle.trim()}
                        className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 px-4 py-1.5 rounded-lg shadow-sm transition-colors"
                    >
                        Add Section
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full bg-white text-slate-800">
            {/* Main Content Column */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                    <div className="px-8 flex items-center justify-between h-20">
                        <h1 className="text-[22px] font-extrabold tracking-tight">Research Report</h1>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    // Export as Markdown
                                    const allSections = sections
                                    let md = `# Research Report\n\n`
                                    const types = ['THEMATIC_SUMMARY', 'FINDING', 'RECOMMENDATION']
                                    const typeLabels: Record<string, string> = { THEMATIC_SUMMARY: 'Thematic Summaries', FINDING: 'Findings & Interpretation', RECOMMENDATION: 'Recommendations' }
                                    types.forEach(t => {
                                        const ss = allSections.filter(s => s.type === t)
                                        if (ss.length > 0) {
                                            md += `## ${typeLabels[t]}\n\n`
                                            ss.forEach(s => {
                                                md += `### ${s.title}\n\n${s.content}\n\n`
                                            })
                                        }
                                    })
                                    const blob = new Blob([md], { type: 'text/markdown' })
                                    const url = URL.createObjectURL(blob)
                                    const a = document.createElement('a')
                                    a.href = url
                                    a.download = 'research-report.md'
                                    a.click()
                                }}
                                className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                Export Markdown
                            </button>
                        </div>
                    </div>

                    <div className="px-8 flex items-center justify-between">
                        <div className="flex items-center space-x-8">
                            {['Thematic Summaries', 'Findings', 'Recommendations'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => { setActiveTab(tab); setAddingBlank(false) }}
                                    className={`py-4 text-[13px] font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    {tab === 'Thematic Summaries' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeTab === tab ? "text-indigo-600" : "text-slate-400"}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>}
                                    {tab === 'Findings' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeTab === tab ? "text-indigo-600" : "text-slate-400"}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>}
                                    {tab === 'Recommendations' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeTab === tab ? "text-indigo-600" : "text-slate-400"}><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z"/></svg>}
                                    {tab}
                                    {tab === 'Thematic Summaries' && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold ml-1">{sections.filter(s => s.type === 'THEMATIC_SUMMARY').length}</span>}
                                    {tab === 'Findings' && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold ml-1">{sections.filter(s => s.type === 'FINDING').length}</span>}
                                    {tab === 'Recommendations' && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold ml-1">{sections.filter(s => s.type === 'RECOMMENDATION').length}</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 custom-scrollbar">
                    <div className="max-w-4xl mx-auto px-8 py-8">
                        {/* Tab: Thematic Summaries */}
                        {activeTab === 'Thematic Summaries' && (
                            <div className="space-y-6">
                                {/* Prompt Editor */}
                                {renderPromptEditor('THEMATIC_SUMMARY', 'Thematic Summary')}

                                {/* Existing summaries */}
                                {currentSections.map((section, idx) => renderSectionCard(section, idx))}

                                {/* Themes without summaries */}
                                {themesWithoutSummaries.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest pt-4">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                            Themes awaiting summary
                                        </div>
                                        {themesWithoutSummaries.map(theme => (
                                            <div key={theme.id} className="bg-white rounded-xl border border-dashed border-slate-300 p-5 flex items-center justify-between hover:border-indigo-300 transition-colors group">
                                                <div>
                                                    <h4 className="text-sm font-extrabold text-slate-700">{theme.name}</h4>
                                                    <p className="text-xs text-slate-400 mt-0.5">{theme.codeLinks.length} codes · {theme.description ? theme.description.slice(0, 80) + '...' : 'No description'}</p>
                                                </div>
                                                <button
                                                    onClick={() => generateDraft('THEMATIC_SUMMARY', theme.id)}
                                                    disabled={generatingId === theme.id}
                                                    className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:bg-slate-50 disabled:text-slate-400 text-xs font-bold px-3.5 py-2 rounded-lg transition-colors shadow-sm"
                                                >
                                                    {generatingId === theme.id ? (
                                                        <>
                                                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                            </svg>
                                                            Drafting...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                                            AI Draft
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Empty state */}
                                {currentSections.length === 0 && themesWithoutSummaries.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                                        </div>
                                        <p className="text-sm font-bold text-slate-400">No themes yet</p>
                                        <p className="text-xs text-slate-300 mt-1">Create themes in the Themes & Network workspace first</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab: Findings */}
                        {activeTab === 'Findings' && (
                            <div className="space-y-6">
                                {/* Prompt Editor */}
                                {renderPromptEditor('FINDING', 'Findings & Interpretation')}

                                {currentSections.length === 0 && !addingBlank ? (
                                    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 flex flex-col items-center text-center">
                                        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                        </div>
                                        <h3 className="text-sm font-extrabold text-slate-700 mb-1">Findings & Interpretation</h3>
                                        <p className="text-xs text-slate-400 mb-5 max-w-sm">AI will analyze how your {themes.length} themes connect, reveal patterns, and address your research question.</p>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => generateDraft('FINDING')}
                                                disabled={generatingId === 'FINDING' || themes.length === 0}
                                                className="flex items-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300 text-xs font-bold px-5 py-2.5 rounded-lg transition-colors shadow-sm"
                                            >
                                                {generatingId === 'FINDING' ? (
                                                    <>
                                                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                                        Analyzing themes...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                                        AI Generate
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setAddingBlank(true)}
                                                className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-bold px-5 py-2.5 rounded-lg transition-colors shadow-sm"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                                Write Manually
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {currentSections.map(section => renderSectionCard(section))}
                                        {/* Action buttons */}
                                        <div className="flex items-center gap-3 pt-2">
                                            <button
                                                onClick={() => generateDraft('FINDING')}
                                                disabled={!!generatingId || themes.length === 0}
                                                className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:bg-slate-50 disabled:text-slate-400 text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-sm"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                                AI Generate More
                                            </button>
                                            <button
                                                onClick={() => setAddingBlank(true)}
                                                className="flex items-center gap-1.5 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-sm"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                                Add Manually
                                            </button>
                                        </div>
                                    </>
                                )}

                                {/* Blank form */}
                                {renderAddBlankForm('FINDING')}
                            </div>
                        )}

                        {/* Tab: Recommendations */}
                        {activeTab === 'Recommendations' && (
                            <div className="space-y-6">
                                {/* Prompt Editor */}
                                {renderPromptEditor('RECOMMENDATION', 'Recommendations')}

                                {currentSections.length === 0 && !addingBlank ? (
                                    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 flex flex-col items-center text-center">
                                        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z"/></svg>
                                        </div>
                                        <h3 className="text-sm font-extrabold text-slate-700 mb-1">Recommendations & Implications</h3>
                                        <p className="text-xs text-slate-400 mb-5 max-w-sm">AI will derive actionable recommendations from your themes, targeting relevant stakeholders.</p>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => generateDraft('RECOMMENDATION')}
                                                disabled={generatingId === 'RECOMMENDATION' || themes.length === 0}
                                                className="flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-300 text-xs font-bold px-5 py-2.5 rounded-lg transition-colors shadow-sm"
                                            >
                                                {generatingId === 'RECOMMENDATION' ? (
                                                    <>
                                                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                                        Generating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                                        AI Generate
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setAddingBlank(true)}
                                                className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-bold px-5 py-2.5 rounded-lg transition-colors shadow-sm"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                                Write Manually
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {currentSections.map(section => renderSectionCard(section))}
                                        {/* Action buttons */}
                                        <div className="flex items-center gap-3 pt-2">
                                            <button
                                                onClick={() => generateDraft('RECOMMENDATION')}
                                                disabled={!!generatingId || themes.length === 0}
                                                className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:bg-slate-50 disabled:text-slate-400 text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-sm"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                                AI Generate More
                                            </button>
                                            <button
                                                onClick={() => setAddingBlank(true)}
                                                className="flex items-center gap-1.5 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-sm"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                                Add Manually
                                            </button>
                                        </div>
                                    </>
                                )}

                                {/* Blank form */}
                                {renderAddBlankForm('RECOMMENDATION')}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Panel: AI Assistant */}
            <div className="w-[360px] bg-slate-50 flex flex-col flex-shrink-0 border-l border-slate-200 z-10">
                <div className="p-6 pb-4 bg-[#3E3A86] text-white">
                    <h2 className="text-[17px] font-extrabold flex items-center gap-2 mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-300"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                        AI Writing Assistant
                    </h2>
                    <p className="text-xs text-indigo-200/80 font-medium">Constrained to approved themes & codes</p>
                </div>

                {/* Quick Stats */}
                <div className="px-6 py-4 border-b border-slate-200 space-y-2.5 bg-white">
                    <div className="flex justify-between text-[13px] font-bold text-slate-800">
                        <span>Available themes</span>
                        <span>{themes.length}</span>
                    </div>
                    <div className="flex justify-between text-[13px] font-bold text-slate-800">
                        <span>Total codes</span>
                        <span>{totalCodes}</span>
                    </div>
                    <div className="flex justify-between text-[13px] font-bold text-slate-800 mb-2">
                        <span>Sections drafted</span>
                        <span className="text-indigo-600">{sections.length}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: themes.length > 0 ? `${Math.min(100, (sections.filter(s => s.type === 'THEMATIC_SUMMARY').length / themes.length) * 100)}%` : '0%' }}
                        ></div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">{sections.filter(s => s.type === 'THEMATIC_SUMMARY').length}/{themes.length} theme summaries complete</p>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {chatMessages.map((msg, i) => (
                        <div
                            key={i}
                            className={`rounded-xl p-3 text-[12px] leading-relaxed shadow-sm ${
                                msg.role === 'ai'
                                    ? 'bg-white border border-slate-200 text-slate-600'
                                    : 'bg-indigo-50 border border-indigo-100 text-indigo-700 ml-6'
                            }`}
                        >
                            {msg.role === 'ai' && (
                                <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-bold text-indigo-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                    AI Assistant
                                </div>
                            )}
                            <p className="whitespace-pre-line">{msg.text}</p>
                        </div>
                    ))}
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t border-slate-200 bg-white">
                    <div className="relative">
                        <textarea
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat() } }}
                            className="w-full text-[12px] p-3 pr-10 rounded-xl border border-slate-200 bg-slate-50 min-h-[60px] focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 resize-none placeholder:text-slate-300"
                            placeholder="Ask to draft a summary, interpret findings, or suggest recommendations..."
                        />
                        <button
                            onClick={handleChat}
                            className="absolute bottom-3 right-3 bg-indigo-600 text-white p-1.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                        </button>
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                        <span className="text-[9px] text-slate-400 font-medium">Grounded in approved data only</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
