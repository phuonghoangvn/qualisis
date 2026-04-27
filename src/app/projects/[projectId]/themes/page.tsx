'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ThematicMatrixView from '@/components/ThematicMatrixView'
import ConfirmModal from '@/components/ConfirmModal'
type CodeEntry = {
    id: string
    name: string
    type: string
    instances: number
    definition?: string
    participants?: { id: string, name: string }[]
    memo?: string
}

type ThemeSuggestion = {
    name: string
    tags: string[]
    description: string
    reason?: string
    confidenceScore?: number
    codes: CodeEntry[]
}

type ThemeData = {
    id: string
    name: string
    description: string | null
    memo: string | null
    status: string
    isMeta?: boolean
    parentId?: string | null
    childIds?: string[]
    children?: ThemeData[]
    positionX?: number | null
    positionY?: number | null
    codeLinks: {
        codebookEntry: {
            id: string
            name: string
            type: string
            definition?: string | null
            examplesIn?: string | null
            examplesOut?: string | null
            memo?: string | null
            _count: { codeAssignments: number }
            participants?: { id: string, name: string }[]
        }
    }[]
    participantsCount?: number
}

// Generate consistent background and text colors based on participant name or ID
function getParticipantColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
        'bg-blue-100 text-blue-700 border-blue-200',
        'bg-purple-100 text-purple-700 border-purple-200',
        'bg-pink-100 text-pink-700 border-pink-200',
        'bg-orange-100 text-orange-700 border-orange-200',
        'bg-teal-100 text-teal-700 border-teal-200',
        'bg-cyan-100 text-cyan-700 border-cyan-200',
        'bg-lime-100 text-lime-700 border-lime-200',
        'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
    ];
    return colors[Math.abs(hash) % colors.length];
}

// ─── CSV Export helper ──────────────────────────────────────────────────────
function escapeCell(val: string | null | undefined): string {
    const s = (val ?? '').replace(/\r?\n/g, ' ').replace(/\t/g, ' ')
    // Wrap in quotes if contains comma, quote or newline
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function exportCodebookCSV(themes: ThemeData[], filename = 'codebook.csv') {
    const headers = ['Theme', 'Theme Description', 'Code', 'Code Definition', 'Frequency', 'Participants', 'Participants Count']
    const rows: string[][] = []

    for (const theme of themes) {
        // Count unique participants across all codes in this theme
        const themeParticipantSet = new Set<string>()
        theme.codeLinks.forEach(l => (l.codebookEntry.participants || []).forEach(p => themeParticipantSet.add(p.name)))

        for (const link of theme.codeLinks) {
            const participants = (link.codebookEntry.participants || []).map(p => p.name).join('; ')
            rows.push([
                theme.name,
                theme.description || '',
                link.codebookEntry.name,
                link.codebookEntry.definition || '',
                String(link.codebookEntry._count?.codeAssignments || 0),
                participants,
                String((link.codebookEntry.participants || []).length),
            ])
        }

        if (theme.codeLinks.length === 0) {
            rows.push([theme.name, theme.description || '', '', '', '', '', ''])
        }
    }

    const csvContent = [headers, ...rows]
        .map(row => row.map(escapeCell).join(','))
        .join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

function pColor(name: string) {
    const palette = [
        { bg: '#e0e7ff', text: '#4338ca' }, { bg: '#fce7f3', text: '#be185d' },
        { bg: '#fef3c7', text: '#b45309' }, { bg: '#d1fae5', text: '#065f46' },
        { bg: '#ede9fe', text: '#6d28d9' }, { bg: '#cffafe', text: '#0e7490' },
        { bg: '#fee2e2', text: '#b91c1c' }, { bg: '#d9f99d', text: '#365314' },
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return palette[Math.abs(hash) % palette.length]
}
function pInitials(name: string) {
    return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── ThemeCell: merged rowspan cell with name, description, reflection, status ─
function ThemeCell({ theme, rowSpan, projectId, onUpdate }: { theme: ThemeData; rowSpan: number; projectId: string; onUpdate: () => void }) {
    const [description, setDescription] = useState(theme.description || '')
    const [status, setStatus] = useState(theme.status || 'DRAFT')
    const [editingField, setEditingField] = useState<'description' | null>(null)
    const [draft, setDraft] = useState('')
    const [saving, setSaving] = useState(false)
    const [savedField, setSavedField] = useState<'description' | null>(null) // for flash ✓

    const themeParticipantSet = new Set<string>()
    theme.codeLinks.forEach(l => (l.codebookEntry.participants || []).forEach(p => {
        if (!p.name.toLowerCase().includes('dataset') && p.name !== 'All') {
            themeParticipantSet.add(p.id)
        }
    }))
    const participantCount = themeParticipantSet.size

    const startEdit = (field: 'description') => {
        setDraft(description)
        setEditingField(field)
        setSavedField(null)
    }

    const save = async (field: 'description', value: string) => {
        setSaving(true)
        try {
            const res = await fetch(`/api/projects/${projectId}/themes/${theme.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value })
            })
            if (res.ok) {
                setDescription(value)
                setEditingField(null)
                // Flash "Saved ✓" for 2s
                setSavedField(field)
                setTimeout(() => setSavedField(null), 2000)
                // Refresh parent to keep everything in sync
                onUpdate()
            } else {
                const err = await res.json()
                console.error('Save failed details:', err)
                alert(`Khong the luu: ${err.error || 'Unknown error'}\nDetails: ${err.details || 'Check console'}`)
            }
        } catch (e: any) {
            console.error('Save error connection:', e)
            alert('Loi ket noi khi luu description: ' + e.message)
        }
        setSaving(false)
    }

    const cycleStatus = async () => {
        const next = status === 'DRAFT' ? 'ACTIVE' : status === 'ACTIVE' ? 'FINALIZED' : 'DRAFT'
        try {
            await fetch(`/api/projects/${projectId}/themes/${theme.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: next })
            })
            setStatus(next)
        } catch {}
    }

    const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
        DRAFT:     { bg: '#f1f5f9', text: '#64748b', label: 'Draft' },
        ACTIVE:    { bg: '#dbeafe', text: '#1d4ed8', label: 'Active' },
        FINALIZED: { bg: '#dcfce7', text: '#15803d', label: 'Finalized ✓' },
    }
    const st = STATUS_STYLE[status] ?? STATUS_STYLE.DRAFT

    return (
        <td className="px-5 py-4 border-b border-r border-slate-100 align-top group/theme" rowSpan={rowSpan}>
            {/* Theme name + status badge */}
            <div className="flex items-start justify-between gap-1.5 mb-1">
                <span className="text-[13px] font-extrabold text-slate-800 leading-snug">{theme.name}</span>
                <button
                    onClick={cycleStatus}
                    className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-all cursor-pointer hover:opacity-80"
                    style={{ background: st.bg, color: st.text }}
                    title="Click to advance: Draft → Active → Finalized"
                >
                    {st.label}
                </button>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                <span className="text-[9px] text-slate-400 font-semibold">{theme.codeLinks.length} code{theme.codeLinks.length !== 1 ? 's' : ''}</span>
                {participantCount > 0 && (
                    <span
                        className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{
                            background: participantCount >= 3 ? '#d1fae5' : participantCount === 2 ? '#fef3c7' : '#fee2e2',
                            color: participantCount >= 3 ? '#065f46' : participantCount === 2 ? '#92400e' : '#991b1b'
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        {participantCount} pax
                    </span>
                )}
            </div>

            {/* Description */}
            <InlineEditField
                value={description}
                placeholder="Describe what this theme represents..."
                isEditing={editingField === 'description'}
                onStartEdit={() => startEdit('description')}
                draft={draft} setDraft={setDraft}
                onSave={() => save('description', draft)}
                onCancel={() => setEditingField(null)}
                saving={saving && editingField === 'description'}
                saved={savedField === 'description'}
                emptyClass="opacity-0 group-hover/theme:opacity-100"
                emptyLabel="+ Add description"
            />


        </td>
    )
}

// ─── Reusable inline edit field ───────────────────────────────────────────────
function InlineEditField({
    value, placeholder, isEditing, onStartEdit, draft, setDraft, onSave, onCancel,
    saving, saved = false, emptyClass = '', emptyLabel, rows = 2
}: {
    value: string; placeholder: string; isEditing: boolean
    onStartEdit: () => void; draft: string; setDraft: (v: string) => void
    onSave: () => void; onCancel: () => void; saving: boolean; saved?: boolean
    emptyClass?: string; emptyLabel?: string; rows?: number
}) {
    if (isEditing) return (
        <div>
            <textarea
                autoFocus value={draft} onChange={e => setDraft(e.target.value)}
                placeholder={placeholder} rows={rows}
                className="w-full text-[11px] text-slate-700 bg-white border border-indigo-300 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 leading-relaxed"
            />
            <div className="flex gap-1.5 mt-1 items-center">
                <button onClick={onSave} disabled={saving}
                    className="text-[10px] font-bold px-2.5 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                    {saving ? (
                        <><svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> Saving…</>
                    ) : 'Save'}
                </button>
                <button onClick={onCancel} className="text-[10px] font-bold px-2.5 py-1 border border-slate-200 text-slate-500 rounded-md hover:bg-slate-50 transition-colors">Cancel</button>
            </div>
        </div>
    )
    if (value) return (
        <div className="group/field flex items-start gap-1">
            <p className="text-[11px] text-slate-600 leading-relaxed flex-1">{value}</p>
            <button onClick={onStartEdit} className="opacity-0 group-hover/field:opacity-100 flex-shrink-0 transition-opacity text-slate-300 hover:text-indigo-500 mt-0.5" title="Edit">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
        </div>
    )
    return (
        <button onClick={onStartEdit} className={`flex items-center gap-1 text-[10px] text-slate-300 hover:text-indigo-500 transition-colors ${emptyClass}`}>
            {emptyLabel ?? `+ ${placeholder.split('…')[0]}`}
        </button>
    )
}


// ─── CodebookRow: Theme | Code + Definition | Freq | Excerpt ──
function CodebookRow({ theme, link, isFirstInTheme, themeRowSpan, onTrace, projectId, onUpdate }: {
    theme: ThemeData
    link: ThemeData['codeLinks'][0]
    isFirstInTheme: boolean
    themeRowSpan: number
    onTrace: (codeId: string, codeName: string) => void
    projectId: string
    onUpdate: () => void
}) {
    const router = useRouter()
    const [excerpt, setExcerpt] = useState<{ text: string; transcriptId: string; transcriptName: string; projectId: string; segmentId: string } | null>(null)
    const [loaded, setLoaded] = useState(false)

    // Definition editing state — seed from existing data
    const [definition, setDefinition] = useState(link.codebookEntry.definition || '')
    const [isEditingDef, setIsEditingDef] = useState(false)
    const [defDraft, setDefDraft] = useState('')
    const [defSaving, setDefSaving] = useState(false)
    const defTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        let cancelled = false
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/codebook/${link.codebookEntry.id}/quotes`)
                if (res.ok && !cancelled) {
                    const data = await res.json()
                    if (Array.isArray(data) && data.length > 0 && data[0].quotes?.length > 0) {
                        setExcerpt({
                            text: data[0].quotes[0].text,
                            segmentId: data[0].quotes[0].segmentId,
                            transcriptId: data[0].transcriptId,
                            transcriptName: data[0].transcriptName,
                            projectId: data[0].projectId
                        })
                    }
                }
            } catch {}
            if (!cancelled) setLoaded(true)
        }
        fetchData()
        return () => { cancelled = true }
    }, [link.codebookEntry.id])

    const startEditDef = () => {
        setDefDraft(definition)
        setIsEditingDef(true)
    }

    const saveDef = async (value: string) => {
        setDefSaving(true)
        try {
            const res = await fetch(`/api/codebook/${link.codebookEntry.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ definition: value })
            })
            if (res.ok) setDefinition(value)
        } catch {}
        setDefSaving(false)
        setIsEditingDef(false)
    }

    const participants = link.codebookEntry.participants || []
    const freq = link.codebookEntry._count?.codeAssignments || 0

    return (
        <tr className="hover:bg-slate-50/50 transition-colors group align-top">
            {/* Theme column — merged rows */}
            {isFirstInTheme && (
                <ThemeCell theme={theme} rowSpan={themeRowSpan} projectId={projectId} onUpdate={onUpdate} />
            )}

            {/* Code + Definition column */}
            <td className="px-5 py-3.5 border-b border-r border-slate-100">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-[13px] leading-snug">{link.codebookEntry.name}</span>
                        {/* Single-source warning: if only 1 participant mentioned this code */}
                        {participants.length === 1 && (
                            <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200"
                                title="Only 1 participant mentioned this code — consider whether it's too specific or needs more evidence"
                            >
                                Single source
                            </span>
                        )}
                    </div>
                    {/* Freq badge */}
                    <span className="flex-shrink-0 text-[10px] font-extrabold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full" title={`${freq} quote${freq !== 1 ? 's' : ''} assigned`}>
                        {freq}×
                    </span>
                </div>

                {/* Definition area */}
                {isEditingDef ? (
                    <div className="mt-1.5">
                        <textarea
                            autoFocus
                            value={defDraft}
                            onChange={e => setDefDraft(e.target.value)}
                            placeholder="Describe what this code means, when to apply it..."
                            rows={3}
                            className="w-full text-[11px] text-slate-700 bg-white border border-indigo-300 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 leading-relaxed"
                        />
                        <div className="flex gap-1.5 mt-1.5">
                            <button
                                onClick={() => saveDef(defDraft)}
                                disabled={defSaving}
                                className="text-[10px] font-bold px-2.5 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                {defSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                                onClick={() => setIsEditingDef(false)}
                                className="text-[10px] font-bold px-2.5 py-1 border border-slate-200 text-slate-500 rounded-md hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : definition ? (
                    <div className="group/def flex items-start gap-1.5 mt-1">
                        <p className="text-[11px] text-slate-500 leading-relaxed flex-1 italic">{definition}</p>
                        <button
                            onClick={startEditDef}
                            className="opacity-0 group-hover/def:opacity-100 flex-shrink-0 transition-opacity text-slate-300 hover:text-indigo-500"
                            title="Edit definition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={startEditDef}
                        className="mt-1 flex items-center gap-1 text-[10px] text-slate-300 hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                        Add definition
                    </button>
                )}
            </td>

            {/* Sample Excerpt column */}
            <td className="px-5 py-3.5 border-b border-slate-100">
                {!loaded ? (
                    <span className="text-[11px] text-slate-300 italic">Loading…</span>
                ) : excerpt ? (
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3 italic">"{excerpt.text}"</p>
                        <button
                            onClick={() => router.push(`/projects/${excerpt.projectId}/transcripts/${excerpt.transcriptId}${excerpt.segmentId ? `?segment=${excerpt.segmentId}` : ''}`)}
                            title={`Source: ${excerpt.transcriptName}`}
                            className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md hover:bg-indigo-100"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
                            Trace
                        </button>
                    </div>
                ) : (
                    <span className="text-[11px] text-slate-300 italic">No excerpt yet</span>
                )}
            </td>
        </tr>
    )
}


export default function ThemesPage() {
    const params = useParams()
    const router = useRouter()
    const projectId = params.projectId as string

    const [activeTab, setActiveTab] = useState('Theme Map')
    const [unassignedCodes, setUnassignedCodes] = useState<CodeEntry[]>([])
    const [themes, setThemes] = useState<ThemeData[]>([])
    const [themeSuggestions, setThemeSuggestions] = useState<ThemeSuggestion[]>([])
    const [loading, setLoading] = useState(true)
    const [suggestionsLoading, setSuggestionsLoading] = useState(false)
    const [acceptingId, setAcceptingId] = useState<number | null>(null)
    const [suggestionsRemainingAfterBatch, setSuggestionsRemainingAfterBatch] = useState(0)
    const [suggestionBatchOffset, setSuggestionBatchOffset] = useState(0)
    const [suggestionsTotalUnassigned, setSuggestionsTotalUnassigned] = useState(0)
    // Selected theme in Thematic Map for drill-down
    const [mapSelectedTheme, setMapSelectedTheme] = useState<ThemeData | null>(null)

    // Panel collapse states
    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true)
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(false)

    const [themeSearchQuery, setThemeSearchQuery] = useState('')
    const [unassignedSearch, setUnassignedSearch] = useState('')
    const [expandedThemes, setExpandedThemes] = useState<Record<string, boolean>>({})

    const [synthModalOpen, setSynthModalOpen] = useState(false)
    const [synthLoading, setSynthLoading] = useState(false)
    const [synthSuggestions, setSynthSuggestions] = useState<any[]>([])
    const [synthAcceptingId, setSynthAcceptingId] = useState<number | null>(null)
    const [lastMergedThemeId, setLastMergedThemeId] = useState<string | null>(null)
    const [undoingMerge, setUndoingMerge] = useState(false)

    // Drag-over state: tracks which card is being hovered during a drag
    const [dragOverThemeId, setDragOverThemeId] = useState<string | null>(null)
    // What type of thing is being dragged: 'code', 'theme', or 'mega'
    const [draggingType, setDraggingType] = useState<'code' | 'theme' | 'mega' | null>(null)
    // Toast for unsupported operations
    const [dropWarning, setDropWarning] = useState<string | null>(null)

    const visibleThemes = useMemo(() => {
        if (!themeSearchQuery.trim()) return themes;
        const q = themeSearchQuery.toLowerCase();
        return themes.filter(t => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.codeLinks?.some(link => link.codebookEntry.name.toLowerCase().includes(q)));
    }, [themes, themeSearchQuery])

    // Theme Modal states (used for both create and edit)
    const [newThemeModal, setNewThemeModal] = useState({ open: false, id: undefined as string | undefined, name: '', description: '', isMegaTheme: false as boolean | undefined })

    // Prompt editor state for theme suggestions
    const DEFAULT_THEME_PROMPT = `Group these codes into meaningful THEMES.

For each suggested theme, provide:
- A clear theme name. MUST be a plain-English, conversational sentence stating the core idea directly (e.g. "Users distrust AI because it feels opaque"). DO NOT use academic titles or jargon like "Dynamics of...", "Role of...", or "Patterns in...".
- 1-2 emotional/conceptual tags
- A brief description explaining WHY these codes belong together
- Which specific code names belong in this theme

Rules:
- Each code should appear in at most ONE theme
- A theme should have at least 2 codes
- Exhaustive Coverage: Create AS MANY themes as you need to group as many of the provided codes as possible. Leave nothing behind if it fits.`
    const [themePrompt, setThemePrompt] = useState(DEFAULT_THEME_PROMPT)
    const [showPromptEditor, setShowPromptEditor] = useState(false)

    // Trace modal states
    const [tracingCode, setTracingCode] = useState<{id: string, name: string} | null>(null)
    const [tracingQuotes, setTracingQuotes] = useState<any[]>([])
    const [tracingLoading, setTracingLoading] = useState(false)

    // Observation Code creation panel state
    const [showObsPanel, setShowObsPanel] = useState(false)
    const [obsForm, setObsForm] = useState({ label: '', note: '', context: '' })
    const [obsSaving, setObsSaving] = useState(false)

    // Code Deletion state
    const [codeToDelete, setCodeToDelete] = useState<{id: string, name: string} | null>(null)
    const [themeToDelete, setThemeToDelete] = useState<{id: string, name: string} | null>(null)

    const createObservationCode = async () => {
        if (!obsForm.label.trim()) return
        setObsSaving(true)
        try {
            await fetch('/api/codebook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    name: obsForm.label.trim(),
                    definition: obsForm.note.trim() || null,
                    memo: obsForm.context.trim() || null,
                    type: 'OBSERVATION',
                    examplesIn: '',
                    examplesOut: '',
                })
            })
            setObsForm({ label: '', note: '', context: '' })
            setShowObsPanel(false)
            fetchData()
        } catch {}
        setObsSaving(false)
    }







    // Code Drag & Drop Helpers
    const handleDragStart = (e: React.DragEvent, payload: { codeId?: string, fromThemeId?: string, themeId?: string, isMega?: boolean, fromMegaThemeId?: string }) => {
        e.stopPropagation()
        e.dataTransfer.setData('application/json', JSON.stringify(payload))
        e.dataTransfer.effectAllowed = 'move'
        if (payload.codeId) setDraggingType('code')
        else if (payload.isMega) setDraggingType('mega')
        else setDraggingType('theme')
    }

    const handleDragEnd = () => {
        setDraggingType(null)
        setDragOverThemeId(null)
    }

    const handleDragOver = (e: React.DragEvent, themeId?: string) => {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        if (themeId) setDragOverThemeId(themeId)
    }

    const handleDragLeave = (e: React.DragEvent, themeId?: string) => {
        // Only clear if we actually left the card (not just a child element)
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            if (themeId && dragOverThemeId === themeId) setDragOverThemeId(null)
        }
    }

    const handleDropToRoot = async (e: React.DragEvent) => {
        e.preventDefault()
        setDragOverThemeId(null)
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'))
            
            // If dragging from a mega-theme -> Root: remove sub-theme from mega-theme
            if (data.fromMegaThemeId && data.themeId) {
                await fetch(`/api/projects/${projectId}/themes`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ themeId: data.fromMegaThemeId, action: 'REMOVE_THEME', subThemeId: data.themeId })
                })
                fetchData()
                return
            }

            // If dragging code from a theme -> Root: remove code from theme
            if (data.fromThemeId && data.codeId) {
                await fetch(`/api/projects/${projectId}/themes`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ themeId: data.fromThemeId, action: 'REMOVE_CODE', codeId: data.codeId })
                })
                fetchData()
            }
        } catch (err) {}
    }

    const handleDropOnTheme = async (e: React.DragEvent, targetThemeId: string, targetIsMega?: boolean) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOverThemeId(null)
        setDraggingType(null)
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'))

            // Block: dragging a Mega-Theme onto a Mega-Theme
            if (data.themeId && data.isMega && targetIsMega) {
                setDropWarning('❌ Cannot nest a Mega-Theme inside another Mega-Theme. Drag a regular Theme instead.')
                setTimeout(() => setDropWarning(null), 4000)
                return
            }

            // Block: dragging a Mega-Theme onto a regular theme (would create weird nesting)
            if (data.themeId && data.isMega && !targetIsMega) {
                setDropWarning('❌ Cannot drop a Mega-Theme onto a regular Theme. You can only move regular Themes into Mega-Themes.')
                setTimeout(() => setDropWarning(null), 4000)
                return
            }
            
            // Dragging a regular Theme onto a Mega-Theme (or any theme to group it)
            if (data.themeId) {
                if (data.themeId === targetThemeId) return // Cannot drop onto itself
                await fetch(`/api/projects/${projectId}/themes`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ themeId: targetThemeId, action: 'ADD_THEME', subThemeId: data.themeId })
                })
                fetchData()
                return
            }

            // Dragging a Code
            if (!data.codeId) return
            if (data.fromThemeId === targetThemeId) return // Already in this theme
            
            // If moving from another theme, remove from old theme first
            if (data.fromThemeId) {
                await fetch(`/api/projects/${projectId}/themes`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ themeId: data.fromThemeId, action: 'REMOVE_CODE', codeId: data.codeId })
                })
            }
            // Add to new theme
            await fetch(`/api/projects/${projectId}/themes`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ themeId: targetThemeId, action: 'ADD_CODE', codeId: data.codeId })
            })
            fetchData()
        } catch (err) {}
    }

    // Save a new or updated theme via modal
    const saveTheme = async () => {
        if (!newThemeModal.name.trim()) return
        
        if (newThemeModal.id) {
            await fetch(`/api/projects/${projectId}/themes/${newThemeModal.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: newThemeModal.name.trim(),
                    description: newThemeModal.description.trim()
                })
            })
        } else {
            await fetch(`/api/projects/${projectId}/themes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: newThemeModal.name.trim(),
                    description: newThemeModal.description.trim(),
                    isMegaTheme: newThemeModal.isMegaTheme
                })
            })
        }
        setNewThemeModal({ open: false, id: undefined, name: '', description: '', isMegaTheme: false })
        fetchData()
    }

    // Delete a theme
    const deleteTheme = async (themeId: string, themeName: string) => {
        setThemeToDelete({ id: themeId, name: themeName })
    }

    // Load Quotes for a specific Code
    const openTrace = async (codeId: string, codeName: string) => {
        setTracingCode({ id: codeId, name: codeName })
        setTracingLoading(true)
        setTracingQuotes([])
        try {
            const res = await fetch(`/api/codebook/${codeId}/quotes`)
            if (res.ok) {
                const data = await res.json()
                setTracingQuotes(data)
            }
        } catch (err) {}
        setTracingLoading(false)
    }

    // Fetch codebook entries + existing themes
    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [codesRes, themesRes] = await Promise.all([
                fetch(`/api/codebook?projectId=${projectId}`, { cache: 'no-store' }),
                fetch(`/api/projects/${projectId}/themes`, { cache: 'no-store' })
            ])

            const allCodes = await codesRes.json()
            const allThemes = await themesRes.json()

            setThemes(Array.isArray(allThemes) ? allThemes : [])

            // Determine which codes are already assigned to themes
            // NOTE: Must also include codes in children (sub-themes of Mega-Themes) —
            // otherwise those codes appear as "unassigned" in the UI but the API sees them as assigned,
            // causing "Generate Suggestions" to return an empty list silently.
            const assignedCodeIds = new Set<string>()
            if (Array.isArray(allThemes)) {
                allThemes.forEach((theme: ThemeData) => {
                    theme.codeLinks?.forEach(link => {
                        assignedCodeIds.add(link.codebookEntry.id)
                    })
                    // Also collect codes from sub-themes (children of Mega-Themes)
                    ;(theme as any).children?.forEach((child: ThemeData) => {
                        child.codeLinks?.forEach(link => {
                            assignedCodeIds.add(link.codebookEntry.id)
                        })
                    })
                })
            }

            // Filter to unassigned codes only
            const unassigned = (Array.isArray(allCodes) ? allCodes : [])
                .filter((c: any) => !assignedCodeIds.has(c.id))
                .map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    // Rely entirely on the type computed and returned by the API
                    type: c.type,
                    instances: c._count?.codeAssignments ?? 0,
                    definition: c.definition,
                    participants: c.participants
                }))

            setUnassignedCodes(unassigned)

        } catch (e) {
            console.error('Failed to fetch data:', e)
        } finally {
            setLoading(false)
        }
    }, [projectId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // localStorage helpers for persisting suggestions per project
    const STORAGE_KEY = `qualisis_suggestions_${projectId}`
    const REJECTED_KEY = `qualisis_rejected_${projectId}`

    const getRejectedNames = (): Set<string> => {
        try { return new Set(JSON.parse(localStorage.getItem(REJECTED_KEY) || '[]')) } catch { return new Set() }
    }
    const addRejectedName = (name: string) => {
        try {
            const rejected = getRejectedNames()
            rejected.add(name)
            localStorage.setItem(REJECTED_KEY, JSON.stringify(Array.from(rejected)))
        } catch {}
    }
    const saveSuggestionsCache = (suggestions: ThemeSuggestion[]) => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(suggestions)) } catch {}
    }
    const loadSuggestionsCache = (): ThemeSuggestion[] => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
    }
    const clearSuggestionsCache = () => {
        try { localStorage.removeItem(STORAGE_KEY) } catch {}
    }

    // Generate AI theme suggestions
    // batchOffset: 0 = fresh run; >0 = load next batch appended to existing
    const generateSuggestions = useCallback(async (clearCache = false, batchOffset = 0) => {
        if (clearCache) {
            clearSuggestionsCache()
            setSuggestionBatchOffset(0)
            setSuggestionsRemainingAfterBatch(0)
            setSuggestionsTotalUnassigned(0)
            if (batchOffset === 0) setThemeSuggestions([])
        }
        setSuggestionsLoading(true)
        try {
            const res = await fetch(`/api/projects/${projectId}/themes/suggest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customPrompt: themePrompt,
                    rejectedNames: Array.from(getRejectedNames()),
                    batchOffset
                })
            })
            const textRaw = await res.text()
            let data
            try {
                data = JSON.parse(textRaw)
            } catch (jsonErr) {
                alert(`Server crashed (Likely Next.js compilation error):\n${textRaw.slice(0, 150)}...`)
                throw new Error("Server returned non-JSON response")
            }

            if (!res.ok) {
                alert(`Error from API: ${data.error || 'Unknown error'}\nDetails: ${data.details || ''}`)
                throw new Error(data.error)
            }
            const rejected = getRejectedNames()
            const incoming = (data.suggestions || []).filter((s: ThemeSuggestion) => !rejected.has(s.name))

            // If API returned empty suggestions with a reason message, log it for debugging
            if (incoming.length === 0 && data.message) {
                console.warn('[Suggest API] No suggestions returned:', data.message)
            }

            if (batchOffset === 0) {
                // Fresh run — replace all suggestions
                setThemeSuggestions(incoming)
                saveSuggestionsCache(incoming)
            } else {
                // Appending next batch
                setThemeSuggestions(prev => {
                    const merged = [...prev, ...incoming]
                    saveSuggestionsCache(merged)
                    return merged
                })
            }

            // Track remaining codes for "Load more" button
            setSuggestionsRemainingAfterBatch(data.remainingAfterBatch ?? 0)
            setSuggestionsTotalUnassigned(data.totalUnassigned ?? 0)
            const nextOffset = (data.batchOffset ?? 0) + (data.batchSize ?? incoming.length)
            setSuggestionBatchOffset(nextOffset)
        } catch (e) {
            console.error('Failed to generate suggestions:', e)
        } finally {
            setSuggestionsLoading(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, themePrompt])

    // Auto-generate suggestions ONCE on first load — restore from cache if available
    const hasAutoGenerated = React.useRef(false)
    useEffect(() => {
        if (
            !hasAutoGenerated.current &&
            !loading &&
            unassignedCodes.length >= 2 &&
            themeSuggestions.length === 0 &&
            !suggestionsLoading
        ) {
            hasAutoGenerated.current = true
            const cached = loadSuggestionsCache()
            if (cached.length > 0) {
                // Restore from cache — filter out rejected ones
                const rejected = getRejectedNames()
                const visible = cached.filter(s => !rejected.has(s.name))
                if (visible.length > 0) {
                    setThemeSuggestions(visible)
                } else {
                    // All cached suggestions were accepted/rejected — need fresh ones
                    clearSuggestionsCache()
                    generateSuggestions()
                }
            } else {
                generateSuggestions()
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, unassignedCodes.length, themeSuggestions.length, suggestionsLoading, generateSuggestions])

    // Clean up stale suggestions real-time when a code is assigned (accepted/dragged)
    useEffect(() => {
        if (!loading) {
            const unassignedIds = new Set(unassignedCodes.map(c => c.id));

            setThemeSuggestions(prev => {
                if (prev.length === 0) return prev;

                const cleaned = prev.map(suggestion => {
                    const newCodes = suggestion.codes.filter(c => unassignedIds.has(c.id));
                    return { ...suggestion, codes: newCodes };
                }).filter(suggestion => suggestion.codes.length >= 2);

                const isChanged = cleaned.length !== prev.length ||
                    cleaned.some((s, i) => {
                        // Find the same suggestion in prev by name (stable ID)
                        const original = prev.find(p => p.name === s.name)
                        return original ? s.codes.length !== original.codes.length : true
                    });

                if (isChanged) {
                    // Also persist the cleaned version to cache
                    saveSuggestionsCache(cleaned)
                    return cleaned
                }
                return prev;
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unassignedCodes, loading]);


    // Accept a theme suggestion → create theme in DB
    const acceptSuggestion = async (index: number) => {
        const suggestion = themeSuggestions[index]
        if (!suggestion) return

        // Capture BEFORE any await — the cleanup useEffect can shift the array while we wait
        const suggestionName = suggestion.name
        const codeIds = suggestion.codes.map(c => c.id)

        if (codeIds.length === 0) {
            // Codes already cleaned out — just dismiss the card
            setThemeSuggestions(prev => {
                const updated = prev.filter(s => s.name !== suggestionName)
                saveSuggestionsCache(updated)
                return updated
            })
            return
        }

        setAcceptingId(index)
        try {
            const res = await fetch(`/api/projects/${projectId}/themes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: suggestion.name,
                    description: suggestion.description,
                    codeIds
                })
            })

            const data = await res.json()

            if (res.ok) {
                // Filter by NAME (stable), not by index (which may have shifted during await)
                setThemeSuggestions(prev => {
                    const updated = prev.filter(s => s.name !== suggestionName)
                    saveSuggestionsCache(updated)
                    return updated
                })
                // Refresh data to update unassigned list + theme map
                await fetchData()
            } else {
                console.error('Accept suggestion failed:', data)
                alert(`Không thể tạo theme: ${data.error || 'Unknown error'}\n${data.details || ''}`)
            }
        } catch (e: any) {
            console.error('Failed to accept theme (network error):', e)
            alert('Lỗi kết nối khi tạo theme: ' + e.message)
        } finally {
            setAcceptingId(null)
        }
    }

    const rejectSuggestion = (index: number) => {
        const suggestion = themeSuggestions[index]
        if (!suggestion) return
        const name = suggestion.name
        addRejectedName(name)
        // Filter by NAME (stable), not by index
        setThemeSuggestions(prev => {
            const updated = prev.filter(s => s.name !== name)
            saveSuggestionsCache(updated)
            return updated
        })
    }

    // AI Synthesize Themes (Meta-Themes)
    const handleSynthesize = async () => {
        setSynthModalOpen(true)
        setSynthLoading(true)
        setSynthSuggestions([])
        try {
            const res = await fetch(`/api/projects/${projectId}/themes/synthesize`, { method: 'POST' })
            if (res.ok) {
                const data = await res.json()
                setSynthSuggestions(data.suggestions || [])
            }
        } catch (e) { }
        setSynthLoading(false)
    }

    const acceptSynth = async (index: number) => {
        setSynthAcceptingId(index)
        const sg = synthSuggestions[index]
        try {
            if (!sg.matchedIds || sg.matchedIds.length < 2) {
                console.error('Merge cancelled: matchedIds is empty or too short', sg.matchedIds)
                alert('Cannot merge: themes could not be matched. Please click Synthesize Themes again to refresh.')
                setSynthAcceptingId(null)
                return
            }
            const res = await fetch(`/api/projects/${projectId}/themes/merge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: sg.name,
                    description: sg.description,
                    mergedThemeIds: sg.matchedIds
                })
            })
            if (res.ok) {
                const data = await res.json()
                setSynthSuggestions(prev => prev.filter((_, i) => i !== index))
                setLastMergedThemeId(data.newThemeId || null)
                await fetchData()
                if (synthSuggestions.length <= 1) setSynthModalOpen(false)
            } else {
                const errText = await res.text()
                console.error('Merge API error:', res.status, errText)
                alert(`Merge failed (${res.status}). Please try Synthesize Themes again.`)
            }
        } catch (e) {
            console.error('Merge exception:', e)
        }
        setSynthAcceptingId(null)
    }

    // Reset all AI suggestions to blank state — call this whenever codes are returned to unassigned
    // (theme deleted or mega-theme dissolved), because old suggestions are stale.
    const resetSuggestions = () => {
        clearSuggestionsCache()
        setThemeSuggestions([])
        setSuggestionBatchOffset(0)
        setSuggestionsRemainingAfterBatch(0)
        setSuggestionsTotalUnassigned(0)
    }

    const handleUndoMerge = async () => {
        if (!lastMergedThemeId) return
        setUndoingMerge(true)
        try {
            const res = await fetch(`/api/projects/${projectId}/themes/undo-merge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ themeId: lastMergedThemeId })
            })
            if (res.ok) {
                setLastMergedThemeId(null)
                await fetchData()
                // Codes returned to unassigned — old suggestions are stale, reset to fresh state
                resetSuggestions()
            }
        } catch (e) {}
        setUndoingMerge(false)
    }

    const totalCodes = unassignedCodes.length + themes.reduce((acc, t) => {
        const ownCodes = t.codeLinks?.length || 0
        const childCodes = (t.children || []).reduce((s, c) => s + (c.codeLinks?.length || 0), 0)
        return acc + ownCodes + childCodes
    }, 0)
    
    // Total themes created including both top-level and children inside Mega-Themes
    const totalThemesCount = themes.reduce((acc, t) => acc + 1 + (t.children?.length || 0), 0)
    
    const assignedCount = themes.reduce((acc, t) => {
        const ownCodes = t.codeLinks?.length || 0
        const childCodes = (t.children || []).reduce((s, c) => s + (c.codeLinks?.length || 0), 0)
        return acc + ownCodes + childCodes
    }, 0)

    return (
        <div className="flex h-full bg-white text-slate-800">
            {/* Main Content Column */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                    <div className="px-8 flex items-center justify-between h-20">
                        <h1 className="text-[22px] font-extrabold tracking-tight">② Themes & Analysis</h1>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => exportCodebookCSV(themes, `codebook_${projectId}.csv`)}
                                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
                                title="Export codebook to CSV (opens in Excel, Numbers, Google Sheets)"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                Export CSV
                            </button>
                            <button
                                onClick={handleSynthesize}
                                disabled={themes.length < 3}
                                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>
                                Synthesize Themes
                            </button>
                            {/* Two separate create buttons — clearly distinguishable */}
                            <div className="flex items-center rounded-lg overflow-hidden border border-slate-800 shadow-sm">
                                <button
                                    onClick={() => setNewThemeModal({ open: true, id: undefined, name: '', description: '', isMegaTheme: false })}
                                    className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-700 transition-colors border-r border-slate-600"
                                    title="Create a regular theme to group codes"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                    New Theme
                                </button>
                                <button
                                    onClick={() => setNewThemeModal({ open: true, id: undefined, name: '', description: '', isMegaTheme: true })}
                                    className="flex items-center gap-2 bg-slate-800 text-indigo-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-700 transition-colors"
                                    title="Create a Mega-Theme — a folder that groups multiple themes together"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                    Mega-Theme
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="px-8 flex items-center justify-between">
                        <div className="flex items-center space-x-8">
                            {['Theme Map', 'Network & Matrix'].map(tab => (
                                <button 
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`py-4 text-[13px] font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    {tab === 'Theme Map' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeTab === 'Theme Map' ? "text-indigo-600" : "text-slate-400"}><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>}
                                    {tab === 'Network & Matrix' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeTab === 'Network & Matrix' ? "text-indigo-600" : "text-slate-400"}><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>}

                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tab-Content Area — relative so overlays only cover this area, not the header/tabs above */}
                <div className="flex-1 overflow-hidden relative">
                {/* Network & Matrix Tab */}
                {activeTab === 'Network & Matrix' && (
                    <div className="absolute inset-0 z-10 flex overflow-hidden">
                        <ThematicMatrixView
                            themes={themes}
                            assignedCount={assignedCount}
                        />
                    </div>
                )}

                {/* Builder Layout — fills the space, hidden when not on Theme Map */}
                <div className={`absolute inset-0 flex overflow-hidden ${activeTab !== 'Theme Map' ? 'invisible pointer-events-none' : ''}`}>
                    {/* Left Panel: collapsed icon */}
                    {!isLeftPanelOpen && activeTab === 'Theme Map' && (
                        <div className="w-12 border-r border-slate-200 bg-slate-50 flex flex-col items-center py-4 flex-shrink-0 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setIsLeftPanelOpen(true)} title="Expand codes panel">
                            <div className="flex flex-col items-center gap-2 mt-16">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                <div className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{unassignedCodes.length} Codes</div>
                            </div>
                        </div>
                    )}
                    {/* Left Panel: Unassigned Codes */}
                    {isLeftPanelOpen && activeTab === 'Theme Map' && (
                    <div 
                        className="w-[220px] lg:w-[300px] border-r border-slate-200 bg-slate-50/50 flex flex-col flex-shrink-0"
                        onDragOver={handleDragOver}
                        onDrop={handleDropToRoot}
                    >
                        <div className="p-4 border-b border-slate-200/50 flex items-center justify-between bg-white">
                            <h2 className="text-sm font-extrabold flex items-center gap-2 text-slate-800">
                                <button onClick={() => setIsLeftPanelOpen(false)} title="Collapse panel" className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                </button>
                                Unassigned Codes
                            </h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowObsPanel(true)}
                                    title="Add an observation code not tied to a specific quote"
                                    className="flex items-center gap-1 text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-200 hover:bg-violet-100 px-2 py-1 rounded-lg transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                                    Observation
                                </button>
                                <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-sm">
                                    {unassignedCodes.length}
                                </span>
                            </div>
                        </div>



                        {/* Search bar for unassigned codes */}
                        <div className="px-3 py-2 border-b border-slate-200/50 bg-white">
                            <div className="relative">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search codes..."
                                    value={unassignedSearch}
                                    onChange={e => setUnassignedSearch(e.target.value)}
                                    className="w-full pl-7 pr-7 py-1.5 text-[11px] font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                                />
                                {unassignedSearch && (
                                    <button onClick={() => setUnassignedSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-3">
                            {!unassignedSearch && <p className="text-xs text-slate-400 mb-4 font-medium">Drag codes to themes on the right</p>}
                            
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                    <svg className="w-6 h-6 animate-spin mb-3" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    <span className="text-xs font-medium">Loading codes...</span>
                                </div>
                            ) : unassignedCodes.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                                    </div>
                                    <p className="text-xs font-semibold text-slate-500 mb-1">No unassigned codes</p>
                                    <p className="text-[11px] text-slate-400">All codes have been assigned to themes, or no codes exist yet. Run AI analysis on transcripts first.</p>
                                </div>
                            ) : (() => {
                                const filteredCodes = unassignedSearch
                                    ? unassignedCodes.filter(c => c.name.toLowerCase().includes(unassignedSearch.toLowerCase()))
                                    : unassignedCodes
                                if (filteredCodes.length === 0) return (
                                    <div className="text-center py-8">
                                        <p className="text-[11px] font-semibold text-slate-400">No codes match "{unassignedSearch}"</p>
                                    </div>
                                )
                                return filteredCodes.map(code => (
                                        <div 
                                            key={code.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, { codeId: code.id })}
                                            className={`bg-white border rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group ${
                                                code.type === 'OBSERVATION'
                                                    ? 'border-violet-200 hover:border-violet-400'
                                                    : 'border-slate-200 hover:border-indigo-300'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1 mb-1.5">
                                                        {code.type === 'OBSERVATION' && (
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                                                Observation
                                                            </span>
                                                        )}
                                                        {code.type === 'AI-ASSISTED' && (
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275z"/></svg>
                                                                AI Suggested
                                                            </span>
                                                        )}
                                                        {code.type === 'MANUAL' && (
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                                                Human Created
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-[13px] font-bold text-slate-800 leading-snug pr-4">{code.name}</h3>
                                                </div>
                                                <button 
                                                    onClick={() => setCodeToDelete({ id: code.id, name: code.name })}
                                                    className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                                    title="Remove code"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                                </button>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {code.type === 'OBSERVATION' ? (
                                                    <div className="flex flex-col gap-1.5">
                                                        {code.memo && (
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border border-violet-200 text-violet-700 bg-violet-50" title="Context">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                                                                    {code.memo}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {code.definition ? (
                                                            <p className="text-[10px] text-violet-600 italic leading-relaxed line-clamp-2">{code.definition}</p>
                                                        ) : (
                                                            <p className="text-[10px] text-slate-300 italic">No reflexive note yet</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {code.definition && (
                                                            <div className="bg-slate-50 border border-slate-100 rounded p-2">
                                                                <p className="text-[9px] text-slate-500 italic leading-relaxed line-clamp-2" title={code.definition}>
                                                                    {code.definition.includes('[Researcher Note]') ? code.definition.split('[Researcher Note]')[1].replace(':', '').trim() : code.definition}
                                                                </p>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                {code.participants?.map(p => (
                                                                    <span key={p.id} className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${getParticipantColor(p.name)}`} title={`From transcript: ${p.name}`}>
                                                                        <span className="w-1 h-1 rounded-full bg-current opacity-75"></span>
                                                                        {p.name.length > 10 ? p.name.substring(0, 10) + '...' : p.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap ml-2">{code.instances} instances</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {code.type !== 'OBSERVATION' && (
                                                    <div className="flex items-center justify-end mt-1">
                                                        <button 
                                                            onClick={() => openTrace(code.id, code.name)} 
                                                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                                            title="View original quotes"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/></svg>
                                                            Trace
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                            })()}
                        </div>
                    </div>
                    )}

                    {/* Center Panel: Built Themes */}
                    <div className="flex-1 min-w-0 bg-slate-50 relative flex flex-col overflow-hidden">
                        <div className="absolute inset-0 z-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-70"></div>
                        
                        {themes.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center relative z-10 p-8">
                                <div className="text-center mb-10">
                                    <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-3">Build Your Themes</h2>
                                    <p className="text-slate-500 max-w-lg mx-auto leading-relaxed">
                                        You have <strong>{unassignedCodes.length}</strong> codes ready to be clustered. Choose how you want to start analyzing your data.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
                                    {/* Manual Mode Card */}
                                    <div className="bg-white border-2 border-slate-200/60 rounded-3xl p-8 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-100/50 transition-all group flex flex-col h-full">
                                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-3">Build from Scratch</h3>
                                        <p className="text-sm text-slate-500 leading-relaxed mb-8 flex-1">
                                            Create empty theme categories and manually drag-and-drop codes from the left panel into them. Best for deductive research and fine-grained control.
                                        </p>
                                        
                                        {/* Visual Hint */}
                                        <div className="bg-slate-50 rounded-xl p-4 mb-8 border border-slate-100 relative overflow-hidden h-24 flex items-center justify-center">
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-[shimmer_2s_infinite] -skew-x-12"></div>
                                            <div className="flex items-center gap-4 opacity-70">
                                                <div className="w-20 h-8 bg-white border border-slate-200 rounded shadow-sm"></div>
                                                <svg className="text-slate-400 animate-[bounce-x_1.5s_infinite]" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                                                <div className="w-24 h-16 bg-white border-2 border-dashed border-slate-300 rounded-lg"></div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setNewThemeModal({ open: true, id: undefined, name: '', description: '', isMegaTheme: false })}
                                            className="w-full bg-white border-2 border-indigo-100 text-indigo-600 px-6 py-3.5 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-50 hover:border-indigo-200 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                            Create Blank Theme
                                        </button>
                                    </div>

                                    {/* AI Mode Card */}
                                    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 shadow-xl shadow-indigo-200 hover:-translate-y-1 transition-transform group flex flex-col h-full relative overflow-hidden">
                                        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
                                        
                                        <div className="w-14 h-14 bg-white/20 text-white rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm group-hover:rotate-12 transition-transform">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-3">Auto-Cluster with AI</h3>
                                        <p className="text-sm text-indigo-100 leading-relaxed mb-8 flex-1">
                                            Let AI analyze all your unassigned codes and suggest a logical thematic structure. You can review, modify, or reject any suggestion before saving.
                                        </p>

                                        {/* Visual Hint */}
                                        <div className="bg-white/10 rounded-xl p-4 mb-8 border border-white/20 relative overflow-hidden h-24 flex items-center justify-center">
                                            <div className="flex gap-2">
                                                <div className="w-10 h-10 bg-white/20 rounded flex items-center justify-center animate-pulse"><div className="w-4 h-1 bg-white/50 rounded"></div></div>
                                                <div className="w-10 h-10 bg-white/20 rounded flex items-center justify-center animate-pulse delay-75"><div className="w-4 h-1 bg-white/50 rounded"></div></div>
                                                <div className="w-10 h-10 bg-white/20 rounded flex items-center justify-center animate-pulse delay-150"><div className="w-4 h-1 bg-white/50 rounded"></div></div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setIsRightPanelOpen(true);
                                            }}
                                            className="w-full bg-white text-indigo-600 px-6 py-3.5 rounded-xl text-sm font-extrabold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                            Open AI Assistant
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div 
                                className="flex-1 overflow-y-auto p-6 relative z-10 custom-scrollbar"
                                onDragOver={e => e.preventDefault()}
                                onDrop={handleDropToRoot}
                            >
                                {/* Undo Merge Toast */}
                                {lastMergedThemeId && (
                                    <div className="max-w-6xl mx-auto mb-4">
                                        <div className="flex items-center justify-between bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 shadow-sm">
                                            <div className="flex items-center gap-2.5">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 flex-shrink-0"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                                                <p className="text-[12px] font-bold text-amber-800">Themes merged successfully. You can undo this action.</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleUndoMerge}
                                                    disabled={undoingMerge}
                                                    className="flex items-center gap-1.5 bg-white border border-amber-400 text-amber-700 text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors shadow-sm disabled:opacity-50"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                                                    {undoingMerge ? 'Undoing...' : 'Undo Merge'}
                                                </button>
                                                <button
                                                    onClick={() => setLastMergedThemeId(null)}
                                                    className="text-amber-400 hover:text-amber-600 p-1 rounded-lg hover:bg-amber-100 transition-colors"
                                                    title="Dismiss"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="max-w-6xl mx-auto mb-6 relative">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                    <input
                                        type="text"
                                        placeholder={`Search across ${totalThemesCount} themes and codes...`}
                                        value={themeSearchQuery}
                                        onChange={e => setThemeSearchQuery(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 shadow-sm transition-all"
                                    />
                                </div>
                                
                                                            {/* Drag-active global hint banner */}
                                            {draggingType === 'theme' && (
                                                <div className="max-w-6xl mx-auto mb-4">
                                                    <div className="flex items-center gap-2 bg-indigo-600 text-white text-[11px] font-bold px-4 py-2.5 rounded-xl shadow-md">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                                        Thả theme này vào một <strong>Mega-Theme</strong> để nhóm lại — hoặc thả vào <strong>Unassigned Codes</strong> để bỏ nhóm.
                                                    </div>
                                                </div>
                                            )}
                                            {/* Drop warning toast */}
                                            {dropWarning && (
                                                <div className="max-w-6xl mx-auto mb-4">
                                                    <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-[12px] font-bold px-4 py-3 rounded-xl shadow-sm">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                                                        {dropWarning}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex overflow-x-auto gap-6 pb-8 items-start custom-scrollbar h-[calc(100vh-200px)]">
                                    {visibleThemes.map(theme => {
                                        // ── MEGA-THEME (container — isMeta=true, with OR without children) ──
                                        if (theme.isMeta) {
                                            const totalChildCodes = (theme.children || []).reduce((s, c) => s + (c.codeLinks?.length || 0), 0)
                                            const isDragTarget = dragOverThemeId === theme.id
                                            // Block drop if user is dragging a mega-theme
                                            const isBlockedDrop = draggingType === 'mega'
                                            return (
                                                <div
                                                    key={theme.id}
                                                    draggable
                                                    onDragStart={e => handleDragStart(e, { themeId: theme.id, isMega: true })}
                                                    onDragEnd={handleDragEnd}
                                                    onDragOver={e => !isBlockedDrop && handleDragOver(e, theme.id)}
                                                    onDragLeave={e => handleDragLeave(e, theme.id)}
                                                    onDrop={e => handleDropOnTheme(e, theme.id, true)}
                                                    className={`min-w-[350px] w-[350px] max-w-[350px] flex-shrink-0 bg-gradient-to-br from-violet-50 to-indigo-50 border-2 rounded-2xl p-5 shadow-md relative group/card transition-all duration-150 flex flex-col max-h-full ${
                                                        isBlockedDrop
                                                            ? 'cursor-not-allowed opacity-60 border-rose-200'
                                                            : isDragTarget
                                                                ? 'cursor-grab border-indigo-500 shadow-lg shadow-indigo-100 scale-[1.01]'
                                                                : 'cursor-grab active:cursor-grabbing border-indigo-200'
                                                    }`}
                                                >
                                                    {/* Drag-over drop hint */}
                                                    {isDragTarget && (
                                                        <div className="absolute inset-0 rounded-2xl border-2 border-indigo-500 pointer-events-none z-10 flex items-center justify-center">
                                                            <span className="bg-indigo-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                                                                Drop to add to this Mega-Theme
                                                            </span>
                                                        </div>
                                                    )}
                                                    {/* Mega-theme badge */}
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-violet-700 bg-violet-100 border border-violet-300 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                                                Mega-Theme
                                                            </span>
                                                            <h3 className="text-sm font-extrabold text-indigo-900 leading-snug">{theme.name}</h3>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => setNewThemeModal({ open: true, id: theme.id, name: theme.name, description: theme.description || '', isMegaTheme: true })}
                                                                title="Edit name & description"
                                                                className="w-6 h-6 flex items-center justify-center text-indigo-300 hover:text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                                                            </button>
                                                            <button
                                                                onClick={() => deleteTheme(theme.id, theme.name)}
                                                                title="Delete mega-theme"
                                                                className="w-6 h-6 flex items-center justify-center text-indigo-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {theme.description && (
                                                        <p className="text-[11px] text-indigo-700/70 mb-4 leading-relaxed italic">{theme.description}</p>
                                                    )}
                                                    {/* Child sub-theme cards */}
                                                    <div className="flex flex-col gap-3">
                                                        {(theme.children || []).length === 0 && (
                                                            <div className="border-2 border-dashed border-indigo-200 rounded-xl p-5 text-center">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-300 mx-auto mb-2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                                                <p className="text-[11px] font-bold text-indigo-300">Drag themes here to group them</p>
                                                                <p className="text-[10px] text-indigo-200 mt-0.5">This Mega-Theme is empty</p>
                                                            </div>
                                                        )}
                                                        {(theme.children || []).map(child => {
                                                            const childCodes = child.codeLinks || []
                                                            const isChildExpanded = expandedThemes[child.id]
                                                            const childCodesToShow = isChildExpanded ? childCodes : childCodes.slice(0, 3)
                                                            const childHiddenCount = childCodes.length - 3
                                                            const isChildDragTarget = dragOverThemeId === child.id
                                                            return (
                                                                <div
                                                                    key={child.id}
                                                                    draggable
                                                                    onDragStart={e => { e.stopPropagation(); handleDragStart(e, { themeId: child.id, fromMegaThemeId: theme.id }) }}
                                                                    onDragEnd={handleDragEnd}
                                                                    onDragOver={e => handleDragOver(e, child.id)}
                                                                    onDragLeave={e => handleDragLeave(e, child.id)}
                                                                    onDrop={(e) => handleDropOnTheme(e, child.id)}
                                                                    className={`bg-white border rounded-xl p-3.5 shadow-sm transition-all relative group/child ${
                                                                        isChildDragTarget
                                                                            ? 'border-indigo-400 shadow-md shadow-indigo-100 bg-indigo-50/40'
                                                                            : 'border-indigo-100 hover:shadow-md'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-start justify-between mb-2">
                                                                        <h4 className="text-[12px] font-bold text-slate-800 leading-snug pr-2">{child.name}</h4>
                                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                                            <button onClick={() => setNewThemeModal({ open: true, id: child.id, name: child.name, description: child.description || '', isMegaTheme: false })} title="Edit" className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                                                                            </button>
                                                                            <button onClick={() => deleteTheme(child.id, child.name)} title="Delete" className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    {child.description && <p className="text-[10px] text-slate-400 mb-2 italic leading-relaxed line-clamp-2">{child.description}</p>}
                                                                    <div className="flex flex-wrap gap-1 mb-2 min-h-[24px] p-1.5 -mx-1 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                                                                        {childCodes.length === 0 && <div className="text-[10px] text-slate-300 italic mx-auto py-0.5">Drop codes here</div>}
                                                                        {childCodesToShow.map(link => (
                                                                            <span
                                                                                key={link.codebookEntry.id}
                                                                                draggable
                                                                                onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, { codeId: link.codebookEntry.id, fromThemeId: child.id }) }}
                                                                                className="flex items-center gap-1 bg-white border border-indigo-200 text-indigo-700 text-[10px] font-semibold pl-1.5 pr-1 py-0.5 rounded-md shadow-sm cursor-grab hover:border-indigo-400"
                                                                            >
                                                                                <span>{link.codebookEntry.name}</span>
                                                                                <button onClick={async (e) => { e.stopPropagation(); await fetch(`/api/projects/${projectId}/themes`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({themeId: child.id, action:'REMOVE_CODE', codeId: link.codebookEntry.id}) }); fetchData() }} className="text-slate-300 hover:text-rose-500 ml-1">
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                                                                </button>
                                                                            </span>
                                                                        ))}
                                                                        {childHiddenCount > 0 && (
                                                                            <button onClick={() => setExpandedThemes(p => ({...p, [child.id]: !isChildExpanded}))} className="w-full text-center text-[10px] font-bold text-indigo-500 hover:text-indigo-700 bg-indigo-50/50 rounded py-0.5 mt-1">
                                                                                {isChildExpanded ? 'Collapse' : `+ ${childHiddenCount} more codes`}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400 font-medium">{childCodes.length} codes · {child.participantsCount || 0} participants</div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                    {/* Mega-theme footer */}
                                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-indigo-100">
                                                        <span className="text-[10px] text-indigo-500 font-bold">{(theme.children || []).length} sub-themes · {totalChildCodes} total codes</span>
                                                        <button
                                                            onClick={() => { setLastMergedThemeId(theme.id); setTimeout(handleUndoMerge, 0) }}
                                                            className="text-[10px] font-bold text-indigo-400 hover:text-rose-500 flex items-center gap-1"
                                                            title="Dissolve this mega-theme (sub-themes stay)"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                                                            Dissolve
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        }

                                        // ── REGULAR THEME CARD ──
                                        const codesArr = theme.codeLinks || [];
                                        const isExpanded = expandedThemes[theme.id];
                                        const codesToShow = isExpanded ? codesArr : codesArr.slice(0, 3);
                                        const hiddenCount = codesArr.length - 3;
                                        const isRegularDragTarget = dragOverThemeId === theme.id;
                                        
                                        return (
                                            <div 
                                            key={theme.id}
                                            draggable
                                            onDragStart={e => handleDragStart(e, { themeId: theme.id })}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={e => handleDragOver(e, theme.id)}
                                            onDragLeave={e => handleDragLeave(e, theme.id)}
                                            onDrop={(e) => handleDropOnTheme(e, theme.id)}
                                            className={`min-w-[350px] w-[350px] max-w-[350px] flex-shrink-0 border rounded-2xl p-5 shadow-sm transition-all relative group/card cursor-grab active:cursor-grabbing flex flex-col max-h-full overflow-hidden ${
                                                isRegularDragTarget
                                                    ? 'bg-indigo-50 border-indigo-400 shadow-md shadow-indigo-100'
                                                    : 'bg-white border-slate-200/80 hover:shadow-md hover:border-slate-300'
                                            }`}
                                        >
                                            {/* Left accent border strip — instantly distinguishes Theme from Mega-Theme */}
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300 rounded-l-2xl" />
                                            {/* Drag-over hint overlay */}
                                            {isRegularDragTarget && (
                                                <div className="absolute inset-0 rounded-2xl pointer-events-none z-10 flex items-end justify-center pb-3">
                                                    <span className="bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                                        Drop code here · or drag onto a Mega-Theme to nest
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between mb-2.5">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    {/* Drag handle indicator */}
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 flex-shrink-0 ml-1"><title>Drag to group into a Mega-Theme</title><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                                                    {/* "Theme" badge — mirrors Mega-Theme badge for clear type labeling */}
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full uppercase tracking-widest flex-shrink-0">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                                                        Theme
                                                    </span>
                                                    <h3 className="text-sm font-extrabold text-slate-800 truncate">{theme.name}</h3>
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setNewThemeModal({ open: true, id: theme.id, name: theme.name, description: theme.description || '', isMegaTheme: false }) }}
                                                        title="Edit name & description"
                                                        className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteTheme(theme.id, theme.name) }}
                                                        title="Delete theme"
                                                        className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                                    </button>
                                                </div>
                                            </div>
                                            {theme.description && (
                                                <p className="text-xs text-slate-500 mb-3 leading-relaxed line-clamp-2">{theme.description}</p>
                                            )}
                                            <div className="flex flex-col gap-1.5 mb-3 min-h-[30px] p-2 -mx-2 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 overflow-y-auto flex-1 custom-scrollbar">
                                                {codesArr.length === 0 && (
                                                    <div className="text-[10px] text-slate-400 font-medium italic mx-auto w-full text-center py-1">Drop codes here</div>
                                                )}
                                                {codesArr.map(link => (
                                                    <span 
                                                        key={link.codebookEntry.id} 
                                                        draggable
                                                        onDragStart={(e) => {
                                                            e.stopPropagation()
                                                            handleDragStart(e, { codeId: link.codebookEntry.id, fromThemeId: theme.id })
                                                        }}
                                                        className="group flex items-center gap-1.5 bg-white border border-indigo-200 text-indigo-700 text-[10px] font-semibold pl-1.5 pr-1 py-1 rounded-md shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-400"
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            {link.codebookEntry.participants?.map(p => (
                                                                <span key={p.id} className={`flex items-center gap-1 text-[8px] font-bold px-1 py-0.5 rounded border ${getParticipantColor(p.name)}`} title={`From transcript: ${p.name}`}>
                                                                    <span className="w-1 h-1 rounded-full bg-current opacity-75"></span>
                                                                    <span>{p.name.length > 10 ? p.name.substring(0, 10) + '...' : p.name}</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <span className="ml-1">{link.codebookEntry.name}</span>
                                                        <div className="flex gap-0.5 border-l border-indigo-100 pl-1 ml-1">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    openTrace(link.codebookEntry.id, link.codebookEntry.name)
                                                                }}
                                                                title="View quotes"
                                                                className="text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 p-0.5 rounded transition-colors"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/></svg>
                                                            </button>
                                                            <button 
                                                                onClick={async (e) => {
                                                                    e.stopPropagation()
                                                                    await fetch(`/api/projects/${projectId}/themes`, {
                                                                        method: 'PATCH',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ themeId: theme.id, action: 'REMOVE_CODE', codeId: link.codebookEntry.id })
                                                                    })
                                                                    fetchData()
                                                                }}
                                                                title="Remove code from theme"
                                                                className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-0.5 rounded transition-colors"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                                            </button>
                                                        </div>
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="flex items-center justify-between mt-1">
                                                <div className="text-[11px] font-medium text-slate-400">
                                                    {theme.codeLinks?.length || 0} codes assigned
                                                </div>
                                                <div className="flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 shadow-sm" title="Total unique participants in this theme">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                                    {theme.participantsCount || 0} participants
                                                </div>
                                            </div>
                                        </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>


                {/* Codebook Tab */}
                {activeTab === 'Codebook' && (
                    <div className="absolute inset-0 bg-white z-20 flex flex-col overflow-hidden">
                        <div className="flex-shrink-0 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-extrabold text-slate-800">Codebook</h2>
                                <p className="text-[11px] text-slate-400">Click a code to view or add its definition. Hover a row for actions.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full">{themes.length} themes · {assignedCount} codes</span>
                                <button
                                    onClick={() => exportCodebookCSV(themes, `codebook_${projectId}.csv`)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                                    title="Export codebook to CSV (opens in Excel, Numbers, Google Sheets)"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                    Export CSV
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {themes.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-sm font-bold text-slate-300">No themes yet — create some in Builder</p>
                                </div>
                            ) : (
                                <div className="border-b border-slate-200">
                                    <table className="w-full text-left text-sm text-slate-600">
                                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                            <tr className="bg-slate-50">
                                                <th className="px-5 py-3 border-b border-r border-slate-200 w-[18%] text-[10px] font-bold uppercase tracking-wide text-slate-400">Theme</th>
                                                <th className="px-5 py-3 border-b border-r border-slate-200 text-[10px] font-bold uppercase tracking-wide text-slate-400">Code · Definition</th>
                                                <th className="px-5 py-3 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wide text-slate-400">Sample Excerpt</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {themes.flatMap((theme) =>
                                                theme.codeLinks && theme.codeLinks.length > 0 ? theme.codeLinks.map((link, lIdx) => (
                                                    <CodebookRow
                                                        key={`${theme.id}-${link.codebookEntry.id}`}
                                                        theme={theme}
                                                        link={link}
                                                        isFirstInTheme={lIdx === 0}
                                                        themeRowSpan={theme.codeLinks.length}
                                                        onTrace={(codeId, codeName) => openTrace(codeId, codeName)}
                                                        projectId={projectId}
                                                        onUpdate={fetchData}
                                                    />
                                                )) : [
                                                    <tr key={`empty-${theme.id}`}>
                                                        <ThemeCell theme={theme} rowSpan={1} projectId={projectId} onUpdate={fetchData} />
                                                        <td colSpan={2} className="px-5 py-4 border-b border-slate-100 text-[12px] italic text-slate-300">No codes assigned yet</td>
                                                    </tr>
                                                ]
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                </div>
            </div>

            {/* Right Panel: AI Suggestions — collapsed icon */}
            {activeTab === 'Theme Map' && !isRightPanelOpen && (
                <div className="w-12 bg-[#3E3A86] flex flex-col items-center py-4 flex-shrink-0 cursor-pointer hover:bg-[#4a479b] transition-colors" onClick={() => setIsRightPanelOpen(true)} title="Expand AI suggestions">
                    <div className="flex flex-col items-center gap-2 mt-16">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-300"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                        <div className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-extrabold text-indigo-300 uppercase tracking-widest">AI Suggestions</div>
                    </div>
                </div>
            )}

            {/* Right Panel: AI Suggestions — expanded */}
            {activeTab === 'Theme Map' && isRightPanelOpen && (
            <div className="w-[360px] bg-slate-50 flex flex-col flex-shrink-0 border-l border-slate-200 z-10">
                <div className="px-6 py-4 bg-[#3E3A86] text-white">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-[17px] font-extrabold flex items-center gap-2 mb-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-300"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                                AI Theme Suggestions
                            </h2>
                            <p className="text-xs text-indigo-200/80 font-medium ml-7">Based on code co-occurrence</p>
                        </div>
                        <button onClick={() => setIsRightPanelOpen(false)} title="Collapse panel" className="text-indigo-200 hover:text-white p-1 rounded hover:bg-white/10 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    </div>
                </div>

                {/* Prompt Editor Toggle */}
                <div className="border-b border-slate-200 bg-white">
                    <button
                        onClick={() => setShowPromptEditor(!showPromptEditor)}
                        className="w-full px-5 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <span className="text-[11px] font-bold text-slate-600">View/Edit Prompt</span>
                            {themePrompt !== DEFAULT_THEME_PROMPT && <span className="text-[8px] font-extrabold bg-amber-50 text-amber-600 px-1 py-0.5 rounded">MODIFIED</span>}
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-slate-400 transition-transform ${showPromptEditor ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    {showPromptEditor && (
                        <div className="px-4 pb-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AI Instructions</p>
                                {themePrompt !== DEFAULT_THEME_PROMPT && (
                                    <button onClick={() => setThemePrompt(DEFAULT_THEME_PROMPT)} className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                                        Reset
                                    </button>
                                )}
                            </div>
                            <textarea
                                value={themePrompt}
                                onChange={e => setThemePrompt(e.target.value)}
                                className="w-full h-36 text-[10px] p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y font-mono leading-relaxed custom-scrollbar bg-slate-50"
                            />
                        </div>
                    )}
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 bg-slate-50">
                    {suggestionsLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-indigo-400">
                            <svg className="w-8 h-8 animate-spin mb-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span className="text-sm font-bold text-indigo-600">Analyzing code patterns...</span>
                            <span className="text-xs text-indigo-400 mt-1">AI is grouping your codes into themes</span>
                        </div>
                    ) : themeSuggestions.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                            </div>
                            {suggestionsRemainingAfterBatch > 0 ? (
                                <>
                                    <p className="text-xs font-bold text-slate-600 mb-1">Batch completed</p>
                                    <p className="text-[11px] text-slate-400 mb-4">
                                        You've reviewed all suggestions in this batch.<br/>
                                        Ready to analyze the next {Math.min(80, suggestionsRemainingAfterBatch)} codes.
                                    </p>
                                    <button
                                        onClick={() => generateSuggestions(false, suggestionBatchOffset)}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 mx-auto"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                        Analyze next {Math.min(80, suggestionsRemainingAfterBatch)} codes
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="text-xs font-bold text-slate-600 mb-1">No suggestions yet</p>
                                    <p className="text-[11px] text-slate-400 mb-4">
                                        {unassignedCodes.length >= 2 
                                            ? `Ready to analyze ${unassignedCodes.length} unassigned codes.` 
                                            : 'Need at least 2 codes to generate theme suggestions.'}
                                    </p>
                                    {unassignedCodes.length >= 2 && (
                                        <button
                                            onClick={() => generateSuggestions(true)}
                                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                                        >
                                            Generate Suggestions
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        themeSuggestions.map((suggestion, idx) => (
                            <div key={idx} className="bg-indigo-50 border border-indigo-100/80 rounded-xl p-4 shadow-sm relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="flex items-start justify-between mb-2 gap-2">
                                        <h3 className="text-sm font-extrabold text-slate-800 leading-tight">{suggestion.name}</h3>
                                        <div className="flex gap-1 flex-wrap justify-end items-center">
                                            {suggestion.confidenceScore !== undefined && (
                                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-sm tracking-wide ${
                                                    suggestion.confidenceScore >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                                    suggestion.confidenceScore >= 50 ? 'bg-amber-100 text-amber-700' :
                                                    'bg-rose-100 text-rose-700'
                                                }`}>
                                                    {suggestion.confidenceScore}% conf
                                                </span>
                                            )}
                                            {suggestion.tags?.map(tag => (
                                                <span key={tag} className="bg-[#E5DFFF] text-[#554CB1] text-[10px] font-extrabold px-2 py-0.5 rounded-sm tracking-wide">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-[12px] text-[#474DBB] font-medium leading-relaxed mb-2 pr-1">
                                        {suggestion.description}
                                    </p>
                                    {/* Reasoning */}
                                    {suggestion.reason && (
                                        <div className="bg-white/60 border border-indigo-100 rounded-lg p-2.5 mb-3">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                                                Reasoning
                                            </p>
                                            <p className="text-[11px] text-slate-600 leading-relaxed">{suggestion.reason}</p>
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                        {suggestion.codes?.map(code => (
                                            <span key={code.id || code.name} className="bg-white border text-indigo-700/80 border-indigo-100 text-[11px] font-semibold px-2 py-1 rounded shadow-sm">
                                                {code.name}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => acceptSuggestion(idx)}
                                            disabled={acceptingId === idx}
                                            className="flex-1 py-2 bg-[#5B55D6] hover:bg-[#4C47B2] disabled:bg-indigo-300 text-white text-[13px] font-extrabold rounded-md shadow-sm transition-colors flex items-center justify-center gap-1.5 focus:ring-4 focus:ring-indigo-100 outline-none"
                                        >
                                            {acceptingId === idx ? (
                                                <>
                                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                    Creating...
                                                </>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                                    Accept
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => rejectSuggestion(idx)}
                                            disabled={acceptingId === idx}
                                            className="px-3 py-2 bg-slate-100/50 hover:bg-slate-200 text-slate-500 text-[13px] font-extrabold rounded-md shadow-sm transition-colors flex items-center justify-center focus:ring-4 focus:ring-slate-100 outline-none border border-slate-200"
                                            title="Reject suggestion"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    {/* Load next batch banner */}
                    {!suggestionsLoading && suggestionsRemainingAfterBatch > 0 && themeSuggestions.length > 0 && (
                        <div className="mx-1 mt-2 mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[12px] font-bold text-indigo-700">
                                    {suggestionsRemainingAfterBatch} more codes to analyze
                                </p>
                                <p className="text-[10px] text-indigo-400 mt-0.5">
                                    AI processed the first batch. Load more to continue grouping.
                                </p>
                            </div>
                            <button
                                onClick={() => generateSuggestions(false, suggestionBatchOffset)}
                                className="flex-shrink-0 bg-indigo-600 text-white text-[11px] font-bold px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                Analyze next {Math.min(80, suggestionsRemainingAfterBatch)}
                            </button>
                        </div>
                    )}
                </div>
                
                {/* Progress Sidebar Bottom */}
                <div className="p-6 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                    <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">Progress</h4>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-[13px] font-bold text-slate-800 mb-2">
                                <span>Codes assigned</span>
                                <span>{assignedCount} / {totalCodes}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                    style={{ width: totalCodes > 0 ? `${(assignedCount / totalCodes) * 100}%` : '0%' }}
                                ></div>
                            </div>
                        </div>
                        <div className="flex justify-between text-[13px] font-bold text-slate-800">
                            <span>Themes created</span>
                            <span>{totalThemesCount}</span>
                        </div>
                        <div className="flex justify-between text-[13px] font-bold text-slate-800">
                            <span>Codes dropped</span>
                            <span className="text-rose-500">0</span>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* Synthesize Themes Modal */}
            {synthModalOpen && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>
                                    Synthesize Themes
                                </h2>
                                <p className="text-xs font-semibold text-slate-500 mt-0.5">Merging narrow sub-themes into overarching meta-themes</p>
                            </div>
                            <button 
                                onClick={() => setSynthModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                            {synthLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 text-indigo-400">
                                    <svg className="w-10 h-10 animate-spin mb-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                    <p className="text-sm font-bold text-slate-500 animate-pulse">Analyzing connections to build overarching themes...</p>
                                </div>
                            ) : synthSuggestions.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 text-sm font-bold">No meaningful groupings found.</div>
                            ) : (
                                <div className="space-y-6">
                                    {synthSuggestions.map((s, idx) => (
                                        <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className="text-sm font-extrabold text-indigo-700 mb-1">{s.name}</h3>
                                                    <p className="text-xs text-slate-600 leading-relaxed font-medium max-w-2xl">{s.description}</p>
                                                </div>
                                                <button
                                                    onClick={() => acceptSynth(idx)}
                                                    disabled={synthAcceptingId === idx}
                                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[11px] font-bold shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 flex-shrink-0 flex items-center gap-1.5"
                                                >
                                                    {synthAcceptingId === idx ? "Merging..." : "Merge These Themes"}
                                                </button>
                                            </div>
                                            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 mt-4">
                                                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Will merge {s.matchedThemes?.length} child themes:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {s.matchedThemes?.map((t: any) => (
                                                        <span key={t.id} className="bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                                            {t.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* New Theme / Mega-Theme Modal */}
            {newThemeModal.open && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        {/* Modal header — colour coded by type */}
                        <div className={`px-6 py-5 border-b border-slate-100 ${
                            newThemeModal.isMegaTheme ? 'bg-gradient-to-r from-violet-50 to-indigo-50' : 'bg-slate-50'
                        }`}>
                            <div className="flex items-center gap-3 mb-0.5">
                                {newThemeModal.isMegaTheme ? (
                                    <div className="w-8 h-8 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-[15px] font-extrabold text-slate-800">
                                        {newThemeModal.id
                                            ? `Edit ${newThemeModal.isMegaTheme ? 'Mega-Theme' : 'Theme'}`
                                            : newThemeModal.isMegaTheme ? 'Create Mega-Theme' : 'Create New Theme'
                                        }
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        {newThemeModal.isMegaTheme
                                            ? 'A Mega-Theme is a folder — drag regular themes into it to group them.'
                                            : 'A Theme groups related codes together. Drag codes from the left panel.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">
                                    {newThemeModal.isMegaTheme ? 'Mega-Theme Name' : 'Theme Name'}
                                </label>
                                <input
                                    type="text"
                                    autoFocus
                                    value={newThemeModal.name}
                                    onChange={e => setNewThemeModal({ ...newThemeModal, name: e.target.value })}
                                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveTheme() }}
                                    className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 font-bold ${
                                        newThemeModal.isMegaTheme
                                            ? 'border-indigo-200 focus:ring-indigo-400 focus:border-indigo-400'
                                            : 'border-slate-300 focus:ring-indigo-500'
                                    }`}
                                    placeholder={newThemeModal.isMegaTheme ? 'e.g. Trust & Transparency' : 'e.g. Navigation & Wayfinding'}
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">Description (Optional)</label>
                                <textarea
                                    value={newThemeModal.description}
                                    onChange={e => setNewThemeModal({ ...newThemeModal, description: e.target.value })}
                                    className="w-full h-24 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-medium text-slate-600"
                                    placeholder={newThemeModal.isMegaTheme
                                        ? 'What overarching concept does this mega-theme represent?'
                                        : 'What does this theme represent? Explain the central concept...'}
                                />
                            </div>
                            {/* Mega-Theme type toggle — only for new themes */}
                            {!newThemeModal.id && (
                                <div className="pt-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Type</p>
                                    <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => setNewThemeModal(prev => ({ ...prev, isMegaTheme: false }))}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[12px] font-bold transition-colors ${
                                                !newThemeModal.isMegaTheme
                                                    ? 'bg-slate-800 text-white'
                                                    : 'bg-white text-slate-500 hover:bg-slate-50'
                                            }`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                                            Theme
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                                !newThemeModal.isMegaTheme ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                                            }`}>Groups codes</span>
                                        </button>
                                        <div className="w-px bg-slate-200" />
                                        <button
                                            type="button"
                                            onClick={() => setNewThemeModal(prev => ({ ...prev, isMegaTheme: true }))}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[12px] font-bold transition-colors ${
                                                newThemeModal.isMegaTheme
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-white text-slate-500 hover:bg-slate-50'
                                            }`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                            Mega-Theme
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                                newThemeModal.isMegaTheme ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                                            }`}>Groups themes</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 px-6 pb-6">
                            <button onClick={() => setNewThemeModal({ open: false, id: undefined, name: '', description: '', isMegaTheme: false })} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={saveTheme}
                                disabled={!newThemeModal.name.trim()}
                                className={`text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 ${
                                    newThemeModal.isMegaTheme
                                        ? 'bg-indigo-600 hover:bg-indigo-700'
                                        : 'bg-slate-800 hover:bg-slate-900'
                                }`}
                            >
                                {newThemeModal.id
                                    ? 'Save Changes'
                                    : newThemeModal.isMegaTheme ? 'Create Mega-Theme' : 'Create Theme'
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Trace Quotes Modal */}
            {tracingCode && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/></svg>
                                    Code Tracing: {tracingCode.name}
                                </h2>
                                <p className="text-xs font-semibold text-slate-500 mt-0.5">Original quotes assigned to this code</p>
                            </div>
                            <button 
                                onClick={() => setTracingCode(null)}
                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>
                        
                        {/* Content area */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                            {tracingLoading ? (
                                <div className="flex flex-col items-center justify-center py-16 text-indigo-400">
                                    <svg className="w-8 h-8 animate-spin mb-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    <span className="text-sm font-bold text-indigo-600">Retrieving quotes from transcripts...</span>
                                </div>
                            ) : tracingQuotes.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <p className="text-sm font-semibold">No quotes found for this code.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {tracingQuotes.map((tq: any) => (
                                        <div key={tq.transcriptId} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                                                <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
                                                    {tq.transcriptName}
                                                </h3>
                                                <span className="text-[10px] font-bold text-slate-400">{tq.quotes.length} highlights</span>
                                            </div>
                                            <div className="divide-y divide-slate-100">
                                                {tq.quotes.map((q: any) => (
                                                    <div key={q.segmentId} className="p-4 hover:bg-slate-50/80 transition-colors group">
                                                        <p className="text-[13px] leading-relaxed text-slate-700 italic border-l-2 border-indigo-200 pl-3">"{q.text}"</p>
                                                        <div className="mt-3 flex items-center justify-between">
                                                            <div>
                                                                {q.confidence && (
                                                                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-500">
                                                                        AI Conf: {q.confidence}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button 
                                                                onClick={() => {
                                                                    router.push(`/projects/${tq.projectId}/transcripts/${tq.transcriptId}?segment=${q.segmentId}`)
                                                                }}
                                                                className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded shadow-sm hover:bg-indigo-100 hover:text-indigo-800 transition-all flex items-center gap-1"
                                                            >
                                                                Go to source
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Observation Code Creation Panel ── */}
            {showObsPanel && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowObsPanel(false)}>
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-slate-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-violet-50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-extrabold text-violet-900">New Observation Code</h3>
                                    <p className="text-[10px] text-violet-500 font-medium">Capture latent meanings not tied to a specific quote</p>
                                </div>
                            </div>
                            <button onClick={() => setShowObsPanel(false)} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>

                        {/* Form */}
                        <div className="p-6 space-y-4">
                            {/* Code Label */}
                            <div>
                                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                                    Code Label <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    autoFocus
                                    value={obsForm.label}
                                    onChange={e => setObsForm(f => ({ ...f, label: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter' && obsForm.label.trim()) createObservationCode() }}
                                    placeholder="E.g., Nervous body language, Unspoken grief…"
                                    className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-slate-800 placeholder:text-slate-300 bg-slate-50 focus:bg-white transition-colors"
                                />
                            </div>

                            {/* Reflexive Note */}
                            <div>
                                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                                    Reflexive Note <span className="font-normal text-slate-300 normal-case">(optional)</span>
                                </label>
                                <textarea
                                    value={obsForm.note}
                                    onChange={e => setObsForm(f => ({ ...f, note: e.target.value }))}
                                    placeholder="Why are you coding this? What evidence — verbal, non-verbal, or contextual — supports this observation?"
                                    rows={3}
                                    className="w-full text-[12px] font-medium border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-slate-700 placeholder:text-slate-300 bg-slate-50 focus:bg-white transition-colors resize-none leading-relaxed"
                                />
                                <p className="text-[9px] text-slate-400 mt-1 px-1">📌 Saved to the Codebook definition. Supports reflexivity in your research write-up.</p>
                            </div>

                            {/* Context */}
                            <div>
                                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                                    Context — Participant / Setting <span className="font-normal text-slate-300 normal-case">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={obsForm.context}
                                    onChange={e => setObsForm(f => ({ ...f, context: e.target.value }))}
                                    placeholder="E.g., P1 and P3, interview room, phone call…"
                                    className="w-full text-[12px] font-medium border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-slate-700 placeholder:text-slate-300 bg-slate-50 focus:bg-white transition-colors"
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                            <p className="text-[10px] text-slate-400 italic max-w-[220px] leading-relaxed">This code will appear in Unassigned Codes and can be dragged into any theme.</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowObsPanel(false)}
                                    className="px-4 py-2 text-[12px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={createObservationCode}
                                    disabled={!obsForm.label.trim() || obsSaving}
                                    className="px-5 py-2 bg-violet-600 text-white text-[12px] font-bold rounded-xl hover:bg-violet-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                                >
                                    {obsSaving ? (
                                        <><svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Saving…</>
                                    ) : (
                                        <><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg> Create Code</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* General Delete Confirmation */}
            <ConfirmModal
                isOpen={codeToDelete !== null}
                title="Remove Code"
                message={`Are you sure you want to remove the code "${codeToDelete?.name}"?\n\nThis will remove the Codebook Entry. Any original quotes will go back to 'Pending AI Review' status.`}
                confirmText="Remove"
                isDestructive={true}
                onConfirm={async () => {
                    if (codeToDelete) {
                        await fetch(`/api/codebook/${codeToDelete.id}`, { method: 'DELETE' })
                        setCodeToDelete(null)
                        fetchData()
                    }
                }}
                onCancel={() => setCodeToDelete(null)}
            />
            <ConfirmModal
                isOpen={themeToDelete !== null}
                title="Delete Theme"
                message={`Delete theme "${themeToDelete?.name}"?\n\nAll code assignments within this theme will be removed.`}
                confirmText="Delete"
                isDestructive={true}
                onConfirm={async () => {
                    if (themeToDelete) {
                        await fetch(`/api/projects/${projectId}/themes/${themeToDelete.id}`, { method: 'DELETE' })
                        setThemeToDelete(null)
                        await fetchData()
                        // Codes returned to unassigned — old suggestions are stale, reset to fresh state
                        resetSuggestions()
                    }
                }}
                onCancel={() => setThemeToDelete(null)}
            />
        </div>
    )
}
