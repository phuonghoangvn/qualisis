'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, UploadCloud, CheckCircle2, AlertCircle, Loader2, FileText, Pencil } from 'lucide-react'
import { createPortal } from 'react-dom'

type FileStatus = 'pending' | 'parsing' | 'ready' | 'uploading' | 'done' | 'error'

interface QueueItem {
    id: string
    file: File
    title: string
    content: string | null
    status: FileStatus
    error?: string
    editingTitle: boolean
}

export default function UploadDatasetWrapper({ projectId, asCard, asSidebarIcon }: { projectId: string, asCard?: boolean, asSidebarIcon?: boolean }) {
    const [isOpen, setIsOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [queue, setQueue] = useState<QueueItem[]>([])
    const [isDraggingOver, setIsDraggingOver] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    useEffect(() => { setMounted(true) }, [])

    function resetModal() {
        setQueue([])
        setIsDraggingOver(false)
        setIsProcessing(false)
    }

    function closeModal() {
        setIsOpen(false)
        resetModal()
    }

    function stripExt(name: string) {
        return name.replace(/\.[^/.]+$/, '')
    }

    async function parseFile(file: File): Promise<string> {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/parse', { method: 'POST', body: formData })
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.error || 'Failed to extract text')
        }
        const data = await res.json()
        return data.text as string
    }

    const addFiles = useCallback(async (files: File[]) => {
        const validTypes = ['.txt', '.md', '.pdf', '.docx', '.vtt']
        const validFiles = files.filter(f => validTypes.some(ext => f.name.toLowerCase().endsWith(ext)))
        if (validFiles.length === 0) return

        const newItems: QueueItem[] = validFiles.map(f => ({
            id: crypto.randomUUID(),
            file: f,
            title: stripExt(f.name),
            content: null,
            status: 'parsing',
            editingTitle: false,
        }))

        setQueue(prev => [...prev, ...newItems])

        // Parse all new files in parallel
        await Promise.all(newItems.map(async (item) => {
            try {
                const text = await parseFile(item.file)
                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, content: text, status: 'ready' } : q))
            } catch (e: any) {
                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: e.message } : q))
            }
        }))
    }, [])

    function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files) return
        addFiles(Array.from(e.target.files))
        e.target.value = ''
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault()
        setIsDraggingOver(false)
        if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files))
    }

    function removeItem(id: string) {
        setQueue(prev => prev.filter(q => q.id !== id))
    }

    function updateTitle(id: string, title: string) {
        setQueue(prev => prev.map(q => q.id === id ? { ...q, title } : q))
    }

    function toggleEditTitle(id: string, val: boolean) {
        setQueue(prev => prev.map(q => q.id === id ? { ...q, editingTitle: val } : q))
    }

    const readyCount = queue.filter(q => q.status === 'ready').length
    const doneCount = queue.filter(q => q.status === 'done').length
    const allDone = queue.length > 0 && queue.every(q => q.status === 'done' || q.status === 'error')

    async function handleUploadAll() {
        const toUpload = queue.filter(q => q.status === 'ready' && q.content && q.title.trim())
        if (toUpload.length === 0) return
        setIsProcessing(true)

        for (const item of toUpload) {
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q))
            try {
                const metadataPayload = {
                    columns: ['Speaker Tag'],
                    participants: [{ 'Speaker Tag': 'P1', _type: 'participant' }],
                    interviewer: { 'Speaker Tag': 'Interviewer', _type: 'interviewer' }
                }
                const res = await fetch(`/api/projects/${projectId}/datasets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        datasetName: `Dataset: ${item.title}`,
                        files: [{ title: item.title, content: item.content, metadata: metadataPayload }]
                    })
                })
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}))
                    throw new Error(errData.error || 'Upload failed')
                }
                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done' } : q))
            } catch (e: any) {
                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: e.message } : q))
            }
        }

        setIsProcessing(false)
        router.refresh()
    }

    const statusIcon = (item: QueueItem) => {
        switch (item.status) {
            case 'parsing': return <Loader2 className="w-4 h-4 animate-spin text-indigo-500 flex-shrink-0" />
            case 'ready': return <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
            case 'uploading': return <Loader2 className="w-4 h-4 animate-spin text-indigo-500 flex-shrink-0" />
            case 'done': return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            case 'error': return <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
        }
    }

    const statusLabel = (item: QueueItem) => {
        switch (item.status) {
            case 'parsing': return <span className="text-[10px] font-bold text-indigo-500">Extracting text...</span>
            case 'ready': return <span className="text-[10px] font-bold text-slate-400">Ready</span>
            case 'uploading': return <span className="text-[10px] font-bold text-indigo-500">Uploading...</span>
            case 'done': return <span className="text-[10px] font-bold text-emerald-500">Done</span>
            case 'error': return <span className="text-[10px] font-bold text-rose-500" title={item.error}>Error</span>
        }
    }

    return (
        <>
            {asSidebarIcon ? (
                <button onClick={() => setIsOpen(true)} className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-md border border-dashed border-slate-300 text-[11px] font-medium text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors">
                    <Plus className="w-3 h-3" /> Add New
                </button>
            ) : asCard ? (
                <button onClick={() => setIsOpen(true)} className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl shadow-sm shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all mt-4">
                    <Plus className="w-4 h-4" /> Add Data to Workspace
                </button>
            ) : (
                <button onClick={() => setIsOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm transition-colors text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Upload Transcripts
                </button>
            )}

            {mounted && isOpen && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-4 flex-shrink-0">
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                            <div>
                                <h2 className="text-base font-bold text-slate-800">Upload Transcripts</h2>
                                <p className="text-[11px] text-slate-400 font-medium">Select one or more files to upload</p>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar flex flex-col gap-5">

                            {/* Drop zone */}
                            <div
                                className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer
                                    ${isDraggingOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-slate-50'}`}
                                onDragOver={e => { e.preventDefault(); setIsDraggingOver(true) }}
                                onDragLeave={() => setIsDraggingOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".txt,.md,.pdf,.docx,.vtt"
                                    multiple
                                    onChange={handleFileInputChange}
                                    className="hidden"
                                />
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-colors ${isDraggingOver ? 'bg-indigo-200 text-indigo-600' : 'bg-white shadow-sm text-indigo-400'}`}>
                                    <UploadCloud className="w-6 h-6" />
                                </div>
                                <p className="text-sm font-bold text-slate-700">
                                    {isDraggingOver ? 'Drop files here' : 'Click or drag files to upload'}
                                </p>
                                <p className="text-xs text-slate-400 mt-1 font-medium">
                                    Supports .txt, .pdf, .docx, .vtt · Multiple files at once
                                </p>
                            </div>

                            {/* Queue list */}
                            {queue.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                                            Queue ({queue.length} file{queue.length !== 1 ? 's' : ''})
                                        </p>
                                        {doneCount > 0 && (
                                            <p className="text-[11px] font-bold text-emerald-600">{doneCount} uploaded ✓</p>
                                        )}
                                    </div>

                                    {queue.map(item => (
                                        <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                                            item.status === 'done' ? 'bg-emerald-50 border-emerald-100' :
                                            item.status === 'error' ? 'bg-rose-50 border-rose-100' :
                                            item.status === 'uploading' || item.status === 'parsing' ? 'bg-indigo-50/60 border-indigo-100' :
                                            'bg-white border-slate-200'
                                        }`}>
                                            {statusIcon(item)}

                                            <div className="flex-1 min-w-0">
                                                {item.editingTitle ? (
                                                    <input
                                                        autoFocus
                                                        value={item.title}
                                                        onChange={e => updateTitle(item.id, e.target.value)}
                                                        onBlur={() => toggleEditTitle(item.id, false)}
                                                        onKeyDown={e => { if (e.key === 'Enter') toggleEditTitle(item.id, false) }}
                                                        className="w-full text-[13px] font-semibold border border-indigo-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-1.5 group">
                                                        <p className="text-[13px] font-semibold text-slate-800 truncate">{item.title || '(Untitled)'}</p>
                                                        {item.status === 'ready' && (
                                                            <button
                                                                onClick={() => toggleEditTitle(item.id, true)}
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-slate-500"
                                                            >
                                                                <Pencil className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {statusLabel(item)}
                                                    <span className="text-[10px] text-slate-300">·</span>
                                                    <span className="text-[10px] text-slate-400 truncate">{item.file.name}</span>
                                                </div>
                                                {item.status === 'error' && item.error && (
                                                    <p className="text-[10px] text-rose-500 mt-0.5 leading-tight">{item.error}</p>
                                                )}
                                            </div>

                                            {(item.status === 'ready' || item.status === 'error') && (
                                                <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-rose-400 transition-colors flex-shrink-0">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0 bg-slate-50/50">
                            <div>
                                {allDone ? (
                                    <p className="text-[12px] font-bold text-emerald-600">All files uploaded successfully!</p>
                                ) : readyCount > 0 ? (
                                    <p className="text-[12px] font-medium text-slate-500">{readyCount} file{readyCount !== 1 ? 's' : ''} ready to upload</p>
                                ) : queue.some(q => q.status === 'parsing') ? (
                                    <p className="text-[12px] font-medium text-indigo-500">Extracting text from files...</p>
                                ) : (
                                    <p className="text-[12px] font-medium text-slate-400">Add files above to begin</p>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    {allDone ? 'Close' : 'Cancel'}
                                </button>
                                {!allDone && (
                                    <button
                                        onClick={handleUploadAll}
                                        disabled={isProcessing || readyCount === 0}
                                        className="px-6 py-2.5 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2 min-w-[160px] justify-center"
                                    >
                                        {isProcessing ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                                        ) : (
                                            <>
                                                <UploadCloud className="w-4 h-4" />
                                                Upload {readyCount > 0 ? `${readyCount} File${readyCount !== 1 ? 's' : ''}` : 'All'}
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
