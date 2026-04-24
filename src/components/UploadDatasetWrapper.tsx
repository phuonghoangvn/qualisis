'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, UploadCloud } from 'lucide-react'
import { createPortal } from 'react-dom'


export default function UploadDatasetWrapper({ projectId, asCard, asSidebarIcon }: { projectId: string, asCard?: boolean, asSidebarIcon?: boolean }) {
    const [isOpen, setIsOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [title, setTitle] = useState('')
    const [fileContent, setFileContent] = useState<string | null>(null)
    const [fileName, setFileName] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [preprocessing, setPreprocessing] = useState(false)
    const [preprocessSteps, setPreprocessSteps] = useState<string[]>([])
    const router = useRouter()

    useEffect(() => {
        setMounted(true)
    }, [])



    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files || e.target.files.length === 0) return
        const file = e.target.files[0]

        
        if (!title) {
            setTitle(file.name.replace(/\.[^/.]+$/, ""))
        }
        setFileName(file.name)
        
        setLoading(true)
        setPreprocessing(true)
        setPreprocessSteps(['📄 Extracting text from document...'])

        try {
            const formData = new FormData()
            formData.append('file', file)
            
            const res = await fetch('/api/parse', { method: 'POST', body: formData })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Failed to extract text')
            }
            const data = await res.json()
            setFileContent(data.text)
        } catch (error: any) {
            alert(`Could not extract text: ${error.message}`)
            setFileName(null)
            setFileContent(null)
        } finally {
            setLoading(false)
            setPreprocessing(false)
            setPreprocessSteps([])
        }
    }



    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim() || !fileContent) return

        setLoading(true)
        setPreprocessSteps([])
        
        try {
            // Upload
            const datasetName = `Dataset: ${title}`
            const metadataPayload = {
                columns: ['Speaker Tag'],
                participants: [{ 'Speaker Tag': 'P1', _type: 'participant' }],
                interviewer: { 'Speaker Tag': 'Interviewer', _type: 'interviewer' }
            }

            const res = await fetch(`/api/projects/${projectId}/datasets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    datasetName, 
                    files: [
                        { title, content: fileContent, metadata: metadataPayload }
                    ]
                })
            })
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || 'Failed to upload transcript')
            }
            
            setIsOpen(false)
            setTitle('')
            setFileContent(null)
            setPreprocessSteps([])
            
            if (data.transcripts && data.transcripts.length > 0) {
                router.push(`/projects/${projectId}/transcripts/${data.transcripts[0].id}`)
            } else {
                router.refresh()
            }
        } catch (error: any) {
            alert(error.message || 'Failed to upload transcript')
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

            {mounted && isOpen && typeof document !== 'undefined' && createPortal(
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
                </div>, document.body
            )}
        </>
    )
}
