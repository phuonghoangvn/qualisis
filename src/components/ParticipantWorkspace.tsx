'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ParticipantWorkspace({ transcript, projectId }: { transcript: any, projectId: string }) {
    const router = useRouter()
    const defaultData = {
        columns: ['Speaker Tag', 'Age', 'Gender', 'Role'],
        participants: [
            { 'Speaker Tag': 'P1', 'Age': '34', 'Gender': 'Female', 'Role': 'High School Math Teacher' }
        ],
        interviewer: { 'Speaker Tag': 'Interviewer' }
    }
    const [metadata, setMetadata] = useState(transcript.metadata || defaultData)

    const handleUpdateParticipant = (index: number, col: string, value: string) => {
        const newParticipants = [...metadata.participants]
        newParticipants[index] = { ...newParticipants[index], [col]: value }
        setMetadata({ ...metadata, participants: newParticipants })
    }

    const addColumn = () => {
        const name = prompt('New column name:')
        if (name && !metadata.columns.includes(name)) {
            setMetadata({ ...metadata, columns: [...metadata.columns, name] })
        }
    }

    const addRow = () => {
        const newParticipant = { 'Speaker Tag': `P${metadata.participants.length + 1}` }
        setMetadata({ ...metadata, participants: [...metadata.participants, newParticipant] })
    }

    const handleSave = async () => {
        try {
            const res = await fetch(`/api/projects/${projectId}/transcripts/${transcript.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ metadata })
            })
            if (!res.ok) throw new Error()
            alert('Saved successfully')
            router.refresh()
        } catch {
            alert('Failed to save')
        }
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 relative">
            <header className="px-8 py-5 border-b border-slate-200/60 flex items-center justify-between bg-white flex-shrink-0 z-10 sticky top-0 shadow-sm">
                <div className="flex items-center gap-4">
                    <Link href={`/projects/${projectId}`} className="text-slate-400 hover:text-indigo-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-left"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                    </Link>
                    <div className="w-px h-6 bg-slate-200"></div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 tracking-tight">{transcript.title}: Participant Info</h2>
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                            <span>Edit demographic & metadata variables</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors flex gap-2 items-center">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Export CSV
                    </button>
                    <button onClick={handleSave} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm focus:ring-4 focus:ring-indigo-100">
                        Save Changes
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white border text-left border-slate-200 rounded-2xl p-8 shadow-sm">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-[15px] font-bold text-slate-800">Metadata & Demographics</h3>
                                <p className="text-[13px] font-medium text-slate-500 mt-1">Click any cell to edit the underlying data for this transcript.</p>
                            </div>
                            <button onClick={addColumn} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition flex gap-1.5 items-center">
                                <span className="text-lg leading-none">+</span> Add Column
                            </button>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full">
                                <thead className="bg-slate-50/80 border-b border-slate-200 text-left">
                                    <tr>
                                        {metadata.columns.map((col: string) => (
                                            <th key={col} className="px-5 py-3.5 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {metadata.participants.map((p: any, i: number) => (
                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                            {metadata.columns.map((col: string) => (
                                                <td key={col} className="px-5 py-3">
                                                    <input 
                                                        type="text"
                                                        value={p[col] || ''}
                                                        onChange={e => handleUpdateParticipant(i, col, e.target.value)}
                                                        placeholder="--"
                                                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-[13px] font-bold text-slate-700 placeholder:text-slate-300 placeholder:font-medium"
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    
                                    <tr className="bg-slate-50/30">
                                        <td className="px-5 py-3 text-[13px] font-bold text-slate-700">{metadata.interviewer['Speaker Tag'] || 'Interviewer'}</td>
                                        <td colSpan={metadata.columns.length - 1} className="px-5 py-3 text-[13px] italic font-medium text-slate-400">
                                            Demographics skipped
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <button onClick={addRow} className="w-full py-3 bg-white hover:bg-slate-50 text-[13px] font-bold text-slate-400 hover:text-indigo-600 transition flex items-center justify-center gap-1.5 border-t border-slate-100">
                                <span>+</span> Add Row
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
