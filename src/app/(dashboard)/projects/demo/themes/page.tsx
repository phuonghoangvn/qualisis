'use client';

import React, { useState } from 'react';

const MOCK_THEMES = [
    { id: '1', name: 'Systemic Pressures', desc: 'Overwhelming demands from administration and structure.', codesCount: 5, excerptsCount: 24, emotions: 'Anxiety, Frustration', status: 'Reviewed' },
    { id: '2', name: 'Coping Strategies', desc: 'Micro and macro approaches to surviving the work week.', codesCount: 3, excerptsCount: 15, emotions: 'Exhaustion, Relief', status: 'Draft' },
    { id: '3', name: 'Professional Identity Crisis', desc: 'Disconnect between ideal teaching and reality.', codesCount: 4, excerptsCount: 19, emotions: 'Disillusionment', status: 'Draft' },
];

export default function ThemesPage() {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const [selectedTheme, setSelectedTheme] = useState(MOCK_THEMES[0]);

    return (
        <div className="flex-1 flex overflow-hidden">
            {/* Center Panel */}
            <div className="flex-1 flex flex-col bg-background border-r border-border min-w-[500px]">
                <header className="p-4 border-b border-border bg-card flex justify-between items-center">
                    <h2 className="text-2xl font-bold tracking-tight">Themes</h2>

                    <div className="flex bg-muted p-1 rounded-md">
                        <button
                            onClick={() => setView('table')}
                            className={`px-3 py-1 text-sm font-medium rounded ${view === 'table' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Table View
                        </button>
                        <button
                            onClick={() => setView('graph')}
                            className={`px-3 py-1 text-sm font-medium rounded ${view === 'graph' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Network Graph
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 bg-muted/20 relative">
                    {view === 'table' ? (
                        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
                            <table className="min-w-full divide-y divide-border">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Theme</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Codes</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Emotions</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-sm">
                                    {MOCK_THEMES.map(theme => (
                                        <tr
                                            key={theme.id}
                                            onClick={() => setSelectedTheme(theme)}
                                            className={`cursor-pointer transition-colors ${selectedTheme.id === theme.id ? 'bg-accent/50 border-l-4 border-l-primary' : 'hover:bg-accent/30 border-l-4 border-l-transparent'}`}
                                        >
                                            <td className="px-6 py-4 font-bold">{theme.name}</td>
                                            <td className="px-6 py-4 text-muted-foreground">{theme.desc}</td>
                                            <td className="px-6 py-4">{theme.codesCount} codes ({theme.excerptsCount} quotes)</td>
                                            <td className="px-6 py-4">
                                                <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs">{theme.emotions}</span>
                                            </td>
                                            <td className="px-6 py-4">{theme.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="h-full w-full bg-card rounded-lg border border-border flex items-center justify-center relative overflow-hidden">
                            {/* 
                 In a real implementation we would render React Flow here:
                 <ReactFlow nodes={nodes} edges={edges} /> 
               */}
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>

                            <div className="relative flex flex-col items-center z-10 space-y-12">

                                <div className="absolute w-full h-full pointer-events-none">
                                    <svg className="w-full h-full min-w-[600px] min-h-[400px]">
                                        <line x1="300" y1="100" x2="150" y2="250" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" className="text-muted-foreground opacity-50" />
                                        <line x1="300" y1="100" x2="450" y2="250" stroke="currentColor" strokeWidth="2" className="text-primary opacity-50" />
                                    </svg>
                                </div>

                                <div
                                    className="bg-card w-64 border-2 border-primary rounded-xl p-4 shadow-lg cursor-pointer transform hover:scale-105 transition-transform"
                                    onClick={() => setSelectedTheme(MOCK_THEMES[0])}
                                >
                                    <h3 className="font-bold text-center">Systemic Pressures</h3>
                                    <p className="text-xs text-center text-muted-foreground mt-1">Core node (24 excerpts)</p>
                                </div>

                                <div className="flex gap-16">
                                    <div
                                        className="bg-background w-48 border border-border rounded-xl p-3 shadow cursor-pointer transform hover:scale-105 transition-transform"
                                        onClick={() => setSelectedTheme(MOCK_THEMES[1])}
                                    >
                                        <h3 className="font-semibold text-sm text-center">Coping Strategies</h3>
                                        <p className="text-xs text-center text-muted-foreground text-[10px] mt-1">Reaction to pressure</p>
                                    </div>

                                    <div
                                        className="bg-background w-48 border border-border rounded-xl p-3 shadow cursor-pointer transform hover:scale-105 transition-transform"
                                        onClick={() => setSelectedTheme(MOCK_THEMES[2])}
                                    >
                                        <h3 className="font-semibold text-sm text-center">Identity Crisis</h3>
                                        <p className="text-xs text-center text-muted-foreground text-[10px] mt-1">Result of pressure</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Contextual AI Support for Themes */}
            <aside className="w-96 bg-card flex flex-col overflow-y-auto">
                <div className="p-4 border-b border-border sticky top-0 bg-card z-10">
                    <h3 className="font-semibold">AI Theme Insights</h3>
                    <p className="text-xs text-muted-foreground mt-1">Analysis & Relationships</p>
                </div>

                <div className="p-4 space-y-6">
                    <div className="space-y-4">
                        <h4 className="font-bold text-xl">{selectedTheme.name}</h4>
                        <p className="text-sm text-foreground">{selectedTheme.desc}</p>

                        <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-lg border border-indigo-100 dark:border-indigo-900">
                            <h5 className="font-semibold text-sm mb-2 text-indigo-900 dark:text-indigo-200">AI Relationship Explanation</h5>
                            <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
                                Based on the dataset, **{selectedTheme.name}** is the primary driver for creating **Coping Strategies**. Participants rarely mentioned coping mechanisms outside the context of direct administrative or systemic overload.
                            </p>
                        </div>

                        <div className="bg-rose-50 dark:bg-rose-950/30 p-4 rounded-lg border border-rose-100 dark:border-rose-900 mt-4">
                            <h5 className="font-semibold text-sm mb-2 text-rose-900 dark:text-rose-200 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                                Contradiction Finder
                            </h5>
                            <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed mb-3">
                                Participant 3 stated they actually thrive under shifting expectations, which contradicts the main finding that systemic pressure universally leads to burnout symptoms.
                            </p>
                            <button className="text-xs bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 px-3 py-1.5 rounded hover:bg-rose-300 dark:hover:bg-rose-800 transition-colors">
                                View Negative Case (P3)
                            </button>
                        </div>

                        <div className="space-y-2 mt-6 pt-4 border-t border-border">
                            <h5 className="font-semibold text-sm">Emotional Patterns</h5>
                            <div className="flex gap-2">
                                <span className="bg-accent text-xs px-2 py-1 rounded">Dominant: Anxiety (60%)</span>
                                <span className="bg-accent text-xs px-2 py-1 rounded">Secondary: Resentment (30%)</span>
                            </div>
                        </div>

                        <div className="space-y-2 mt-6 pt-4 border-t border-border">
                            <textarea
                                className="w-full h-24 text-sm p-3 rounded-md border border-input bg-transparent focus:ring-2 focus:ring-primary outline-none"
                                placeholder="Memo your interpretations of this theme here..."
                            ></textarea>
                            <button className="w-full bg-primary text-primary-foreground text-sm font-medium py-2 rounded-md hover:bg-primary/90 transition-colors">
                                Save Memo
                            </button>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
}
