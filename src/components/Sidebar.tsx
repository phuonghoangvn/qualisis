'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useState } from 'react'
import UploadDatasetWrapper from './UploadDatasetWrapper'

type Transcript = { id: string; title: string; status: string }
type Dataset = { id: string; name: string; transcripts: Transcript[] }
type Project = { id: string; name: string; description: string | null; datasets: Dataset[] }

export default function Sidebar({ project }: { project: Project }) {
    const params = useParams()
    const pathname = usePathname()
    const [collapsed, setCollapsed] = useState(false)

    // Using a simplified layout for the workspaces as requested
    const workspaces = [
        { href: `/projects/${project.id}`, icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>, label: 'Data & Transcripts', activeGroup: ['/transcripts', '/projects/[projectId]'] },
        { href: `/projects/${project.id}/themes`, icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-layout-grid"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>, label: 'Themes & Network', activeGroup: ['/themes'] },
        { href: `/projects/${project.id}/report`, icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pen-tool"><path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18z"/><path d="m2.3 2.3 7.286 7.286"/><path d="m11 13 4 4"/></svg>, label: 'Report Drafting', activeGroup: ['/report'] },
    ]

    return (
        <aside className={`${collapsed ? 'w-16' : 'w-[260px]'} flex flex-col h-full bg-slate-50 border-r border-slate-200 transition-all duration-200 flex-shrink-0`}>

            {/* Logo / Project name */}
            <Link href="/projects" className="flex items-center gap-3 px-6 py-6 flex-shrink-0 cursor-pointer hover:bg-slate-100 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white font-bold shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/></svg>
                </div>
                {!collapsed && (
                    <div className="flex flex-col">
                        <span className="text-sm font-extrabold text-slate-800 tracking-tight leading-tight">QualiSIS</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Traceable AI Workstation</span>
                    </div>
                )}
            </Link>

            <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
                {/* Workspaces Section */}
                {!collapsed && (
                    <p className="px-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 mt-2">
                        Workspaces
                    </p>
                )}
                <div className="space-y-1 mb-8">
                    {workspaces.map(ws => {
                        const isActive = ws.activeGroup.some(g => pathname.includes(g)) || (pathname === ws.href)
                        return (
                            <Link key={ws.label} href={ws.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                                    isActive 
                                    ? 'bg-white border border-slate-200 shadow-sm text-indigo-700 font-semibold' 
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-medium border border-transparent'
                                }`}
                            >
                                <span className={isActive ? 'text-indigo-600' : 'text-slate-400'}>{ws.icon}</span>
                                {!collapsed && <span className="text-sm">{ws.label}</span>}
                            </Link>
                        )
                    })}
                </div>

                {/* Data Section */}
                <div className="flex items-center justify-between px-2 mb-3 mt-4">
                    {!collapsed && <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Data</p>}
                    {!collapsed && <UploadDatasetWrapper projectId={project.id} asSidebarIcon />}
                </div>

                <div className="space-y-2">
                    {project.datasets.map(ds => (
                        ds.transcripts.map(t => {
                            const isActive = pathname.includes(t.id) || pathname.includes('datasets')
                            return (
                                <div key={t.id} className="mb-2">
                                    {/* Transcript Group Title */}
                                    <Link 
                                        href={`/projects/${project.id}/transcripts/${t.id}`}
                                        className={`flex items-center justify-between w-full px-3 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                                            isActive ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isActive ? 'rotate-90 text-indigo-500' : 'text-slate-400'}`}><path d="m9 18 6-6-6-6"/></svg>
                                            {!collapsed && <span>{t.title}</span>}
                                        </div>
                                    </Link>

                                    {/* Nested items (always open if active for demo purposes, or just always open) */}
                                    {(!collapsed && isActive) && (
                                        <div className="pl-6 pr-2 mt-1 space-y-0.5">
                                            <Link href={`/projects/${project.id}/transcripts/${t.id}`} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition cursor-pointer ${pathname.endsWith(t.id) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-700'}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={pathname.endsWith(t.id) ? "text-indigo-500" : "text-slate-400"}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                                                <span className="truncate">{t.title.toLowerCase().replace(/\s+/g,'_')}.txt</span>
                                            </Link>
                                            <Link href={`/projects/${project.id}/transcripts/${t.id}/participant`} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition cursor-pointer ${pathname.includes('participant') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-700'}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={pathname.includes('participant') ? "text-indigo-500" : "text-slate-400"}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                                <span>Participant Info</span>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    ))}
                </div>
            </div>
        </aside>
    )
}
