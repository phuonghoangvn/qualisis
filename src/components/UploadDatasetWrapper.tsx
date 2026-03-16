'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, UploadCloud } from 'lucide-react'

// Common demographic fields (default)
const DEFAULT_COLUMNS = ['Speaker Tag', 'Age', 'Gender', 'Role']

export default function UploadDatasetWrapper({ projectId, asCard, asSidebarIcon }: { projectId: string, asCard?: boolean, asSidebarIcon?: boolean }) {
    const [isOpen, setIsOpen] = useState(false)
    const [title, setTitle] = useState('')
    const [fileContent, setFileContent] = useState<string | null>(null)
    const [fileName, setFileName] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [preprocessing, setPreprocessing] = useState(false)
    const [preprocessSteps, setPreprocessSteps] = useState<string[]>([])
    const [autoTranslate, setAutoTranslate] = useState(true)
    const [autoSpeakerDetect, setAutoSpeakerDetect] = useState(true)
    const router = useRouter()

    // Dynamic columns and rows for metadata
    const [columns, setColumns] = useState(DEFAULT_COLUMNS)
    // Row 1: Participant, Row 2: Interviewer (fixed format for simplicity, but editable)
    const [rows, setRows] = useState([
        { 'Speaker Tag': 'P1', 'Age': '', 'Gender': '', 'Role': 'Teacher', _type: 'participant' },
        { 'Speaker Tag': 'Interviewer', 'Age': '', 'Gender': '', 'Role': '', _type: 'interviewer' }
    ])

    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files || e.target.files.length === 0) return
        const file = e.target.files[0]
        const text = await file.text()
        
        // Auto-fill title if empty
        if (!title) {
            setTitle(file.name.replace(/\.[^/.]+$/, ""))
        }
        setFileName(file.name)
        setFileContent(text)
    }

    const handleUpdateRow = (index: number, col: string, value: string) => {
        const newRows = [...rows]
        newRows[index] = { ...newRows[index], [col]: value }
        setRows(newRows)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim() || !fileContent) return

        setLoading(true)
        setPreprocessSteps([])
        
        try {
            let processedContent = fileContent
            
            // Step 1: Preprocess if either option is enabled
            if (autoTranslate || autoSpeakerDetect) {
                setPreprocessing(true)
                setPreprocessSteps(['🔄 Starting preprocessing...'])
                
                try {
                    const ppRes = await fetch(`/api/projects/${projectId}/datasets/preprocess`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content: fileContent,
                            options: { autoTranslate, autoSpeakerDetect }
                        })
                    })
                    
                    if (ppRes.ok) {
                        const ppData = await ppRes.json()
                        processedContent = ppData.processedContent || fileContent
                        setPreprocessSteps(ppData.steps?.map((s: string) => `✅ ${s}`) || ['✅ Done'])
                    } else {
                        setPreprocessSteps(['⚠️ Preprocessing unavailable, uploading original'])
                    }
                } catch {
                    setPreprocessSteps(['⚠️ Preprocessing failed, uploading original'])
                }
                
                setPreprocessing(false)
            }

            // Step 2: Upload
            const datasetName = `Dataset: ${title}`
            const metadataPayload = {
                columns,
                participants: rows.filter(r => r._type === 'participant'),
                interviewer: rows.find(r => r._type === 'interviewer')
            }

            const res = await fetch(`/api/projects/${projectId}/datasets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    datasetName, 
                    files: [
                        { title, content: processedContent, metadata: metadataPayload }
                    ]
                })
            })
            if (!res.ok) throw new Error()
            
            setIsOpen(false)
            setTitle('')
            setFileContent(null)
            setPreprocessSteps([])
            router.refresh()
        } catch (error) {
            alert('Failed to upload transcript')
        } finally {
            setLoading(false)
            setPreprocessing(false)
        }
    }

    return (
        <>
            {asSidebarIcon ? (
                <button
                    onClick={() => setIsOpen(true)}
                    className="text-slate-400 hover:text-indigo-600 transition"
                    title="Add Transcript"
                >
                    <Plus className="w-3.5 h-3.5" />
                </button>
            ) : asCard ? (
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl shadow-sm shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all mt-4"
                >
                    <Plus className="w-4 h-4" /> Add Data to Workspace
                </button>
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm transition-colors text-sm flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> Upload Transcripts
                </button>
            )}

            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-4 flex-shrink-0">
                            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                            <h2 className="text-base font-bold text-slate-800">Upload Transcript</h2>
                        </div>
                        
                        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="mb-6">
                                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-2.5">
                                    Transcript Title
                                </label>
                                <input
                                    autoFocus
                                    required
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Interview 1 - P1"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors shadow-sm"
                                />
                            </div>
                            
                            <div className="mb-8 relative">
                                <input 
                                    type="file" 
                                    accept=".txt,.md,.pdf,.docx,.vtt"
                                    onChange={handleFileSelect}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-colors 
                                    ${fileContent ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-indigo-300'}`}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${fileContent ? 'bg-indigo-100 text-indigo-600' : 'text-indigo-400 bg-white shadow-sm'}`}>
                                        <UploadCloud className="w-5 h-5" />
                                    </div>
                                    {fileContent ? (
                                        <>
                                            <p className="text-[13px] font-bold text-indigo-700 break-all">{fileName}</p>
                                            <p className="text-[11px] text-indigo-500 font-medium mt-1">File attached successfully!</p>
                                        </>
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-800">Click or drag document to upload</p>
                                    )}
                                    <p className="text-xs text-slate-400 mt-1 font-medium">Supports .txt, .pdf, .docx, .vtt (Max 25 MB)</p>
                                </div>
                            </div>

                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-[11px] font-extrabold text-slate-700 tracking-wide">
                                        Metadata & Demographics
                                    </label>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const name = prompt('New column name:')
                                            if (name) setColumns([...columns, name])
                                        }}
                                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                    >
                                        + Add column
                                    </button>
                                </div>
                                
                                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-100">
                                            <tr>
                                                {columns.map(col => (
                                                    <th key={col} className="px-4 py-3 text-[11px] font-semibold text-slate-500">{col}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {rows.map((row, i) => (
                                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                    {columns.map(col => {
                                                        const isInterviewer = row._type === 'interviewer'
                                                        if (isInterviewer && col !== 'Speaker Tag') {
                                                            if (col === columns[1]) {
                                                                return (
                                                                    <td key={col} colSpan={columns.length - 1} className="px-4 py-3 text-slate-400 italic text-xs">
                                                                        Demographics skipped
                                                                    </td>
                                                                )
                                                            }
                                                            return null
                                                        }

                                                        return (
                                                            <td key={col} className="px-4 py-2">
                                                                <input 
                                                                    type="text"
                                                                    value={(row as any)[col] || ''}
                                                                    onChange={e => handleUpdateRow(i, col, e.target.value)}
                                                                    placeholder="--"
                                                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-slate-700 placeholder:text-slate-300"
                                                                />
                                                            </td>
                                                        )
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Preprocessing Options */}
                            <div className="mb-6 bg-gradient-to-r from-indigo-50/50 to-violet-50/50 border border-indigo-100 rounded-xl p-4">
                                <p className="text-[11px] font-extrabold text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                    AI Preprocessing
                                </p>
                                <div className="space-y-2.5">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={autoTranslate} 
                                            onChange={e => setAutoTranslate(e.target.checked)}
                                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                        />
                                        <div>
                                            <span className="text-[12px] font-bold text-slate-700 group-hover:text-indigo-700">Auto-translate to English</span>
                                            <p className="text-[10px] text-slate-400">Detects language and translates non-English transcripts</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={autoSpeakerDetect} 
                                            onChange={e => setAutoSpeakerDetect(e.target.checked)}
                                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                        />
                                        <div>
                                            <span className="text-[12px] font-bold text-slate-700 group-hover:text-indigo-700">Auto-detect speaker labels</span>
                                            <p className="text-[10px] text-slate-400">Adds INTERVIEWER/PARTICIPANT labels if missing</p>
                                        </div>
                                    </label>
                                </div>
                                
                                {/* Preprocessing progress */}
                                {preprocessSteps.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-indigo-100 space-y-1">
                                        {preprocessSteps.map((step, i) => (
                                            <p key={i} className="text-[11px] text-slate-600 font-medium">{step}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-4 justify-end mt-8 pt-6 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || !title.trim() || !fileContent}
                                    className="px-8 py-2.5 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] transition-all disabled:opacity-50 disabled:shadow-none min-w-[160px]"
                                >
                                    {preprocessing ? 'Preprocessing...' : loading ? 'Uploading...' : 'Process & Upload'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
