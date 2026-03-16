'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Plus } from 'lucide-react'

export default function CreateProjectButton({ asCard }: { asCard?: boolean }) {
    const [isOpen, setIsOpen] = useState(false)
    const [name, setName] = useState('')
    const [ontology, setOntology] = useState('')
    const [researchQuestions, setResearchQuestions] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim()) return

        setLoading(true)
        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name, 
                    coreOntology: ontology, 
                    researchQuestion: researchQuestions 
                })
            })
            if (!res.ok) throw new Error()
            
            const project = await res.json()
            setIsOpen(false)
            router.push(`/projects/${project.id}`)
        } catch (e) {
            alert('Failed to create project')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            {asCard ? (
                <div 
                    onClick={() => setIsOpen(true)}
                    className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50/30 hover:border-indigo-300 hover:shadow-lg hover:-translate-y-1 hover:shadow-indigo-100/50 transition-all duration-300 group h-64"
                >
                    <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-white group-hover:text-indigo-600 group-hover:shadow-md mb-4 transition-all duration-300">
                        <Plus className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-slate-700 group-hover:text-indigo-700">Create New Project</h3>
                    <p className="text-xs font-medium text-slate-400 mt-1">Setup workspace & variables</p>
                </div>
            ) : (
                <button 
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-md shadow-slate-200"
                >
                    <Plus className="w-4 h-4" /> New Project
                </button>
            )}

            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-800">Create New Project</h2>
                            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                                ✕
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6">
                            <p className="text-sm font-medium text-slate-500 mb-6">
                                Define the parameters of your qualitative analysis workspace. AI code generation will be anchored to your research questions.
                            </p>
                            
                            <div className="mb-5">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Project Name</label>
                                <input
                                    autoFocus
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. STFM Burnout Study"
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                />
                            </div>
                            
                            <div className="mb-5">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Core Topics / Ontology</label>
                                <input
                                    value={ontology}
                                    onChange={e => setOntology(e.target.value)}
                                    placeholder="e.g. Coping mechanisms, Imposter Syndrome"
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                />
                            </div>
                            
                            <div className="mb-6">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Primary Research Question(s)</label>
                                <textarea
                                    value={researchQuestions}
                                    onChange={e => setResearchQuestions(e.target.value)}
                                    placeholder="What is the lived experience of..."
                                    rows={3}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors resize-none mb-2"
                                />
                            </div>
                            
                            <div className="flex gap-3 justify-end mt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !name.trim()}
                                    className="px-6 py-2.5 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Creating...' : 'Create Workspace'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}
