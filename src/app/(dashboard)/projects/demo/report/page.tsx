'use client';

import React, { useState } from 'react';

export default function ReportPage() {
    const [activeTab, setActiveTab] = useState('summary');

    return (
        <div className="flex-1 flex overflow-hidden">
            {/* Center Panel: Report Editor */}
            <div className="flex-1 flex flex-col bg-background border-r border-border">
                <header className="p-4 border-b border-border bg-card">
                    <h2 className="text-2xl font-bold tracking-tight mb-4">Research Report</h2>
                    <div className="flex space-x-1 border-b border-border">
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === 'summary' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Thematic Summaries
                        </button>
                        <button
                            onClick={() => setActiveTab('interpretation')}
                            className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === 'interpretation' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Findings Interpretation
                        </button>
                        <button
                            onClick={() => setActiveTab('recommendation')}
                            className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === 'recommendation' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Recommendations
                        </button>
                        <button
                            onClick={() => setActiveTab('appendix')}
                            className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === 'appendix' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Evidence Appendix
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 bg-muted/20">
                    <div className="max-w-4xl mx-auto bg-card rounded-lg border border-border min-h-[600px] shadow-sm p-8 prose prose-slate dark:prose-invert">
                        {activeTab === 'summary' && (
                            <>
                                <h1 className="text-3xl font-bold mb-6">1. Thematic Summaries</h1>
                                <h2 className="text-xl font-bold text-primary mt-8 mb-4">1.1 Systemic Pressures</h2>
                                <p className="text-foreground leading-relaxed">
                                    The most pervasive theme across all interviews was the overwhelming nature of systemic and administrative pressure. Participants consistently noted that teaching per se was not the primary source of their exhaustion, but rather the shifting expectations and uncompensated extra duties demanded by administration.
                                </p>

                                <div className="bg-muted p-4 border-l-4 border-primary mt-4 rounded-r-md">
                                    <p className="italic text-sm text-muted-foreground mb-2">"It's like no matter how much I prep, the expectations just keep shifting."</p>
                                    <a href="#" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                                        [Trace to: P1, Segment 3]
                                    </a>
                                </div>

                                <h2 className="text-xl font-bold text-primary mt-8 mb-4">1.2 Coping Strategies</h2>
                                <div className="text-muted-foreground italic text-sm p-4 border border-dashed border-border rounded-md bg-secondary flex justify-center items-center h-24">
                                    (Drafting needed. Use AI Assistant to generate from approved findings.)
                                </div>
                            </>
                        )}

                        {activeTab === 'interpretation' && (
                            <>
                                <h1 className="text-3xl font-bold mb-6">2. Findings Interpretation</h1>
                                <p className="text-foreground leading-relaxed">
                                    The data strongly suggests a cycle wherein <strong>Systemic Pressures</strong> directly instigate <strong>Somatic Experiencing of Burnout</strong>, driving teachers toward extreme <strong>Isolation Mechanisms</strong> as their primary means of coping. This challenges the theoretical framework that burnout is solely an emotional state, repositioning it here as a profoundly physical and systemic failure.
                                </p>
                            </>
                        )}

                        {activeTab === 'recommendation' && (
                            <>
                                <h1 className="text-3xl font-bold mb-6">3. Recommendations & Implications</h1>
                                <ul className="list-disc pl-5 space-y-4">
                                    <li>
                                        <strong>For Administration:</strong> Implement a mandatory "No-Contact" prep period where teachers are shielded from parental and administrative inquiries.
                                    </li>
                                    <li>
                                        <strong>For Policy:</strong> Redefine "burnout" in occupational health policies to include somatic and physiological symptoms rather than only psychological ones.
                                    </li>
                                </ul>
                            </>
                        )}

                        {activeTab === 'appendix' && (
                            <>
                                <h1 className="text-3xl font-bold mb-6">Appendix: Evidence Traceability Master List</h1>
                                <div className="space-y-6">
                                    <div className="border border-border p-4 rounded-md">
                                        <div className="flex justify-between">
                                            <h4 className="font-bold font-mono text-sm">Quote ID: 1A</h4>
                                            <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 rounded">Verified</span>
                                        </div>
                                        <p className="italic text-sm my-2">"I went to my car during lunch and just sat in silence for 15 minutes."</p>
                                        <div className="text-xs text-muted-foreground flex gap-4">
                                            <span>Transcript: P1</span>
                                            <span>Theme: Coping Strategies</span>
                                            <span>Code: Isolation</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Panel: Contextual AI Assistant */}
            <aside className="w-96 bg-card border-l border-border flex flex-col">
                <div className="p-4 border-b border-border bg-card z-10">
                    <h3 className="font-semibold flex items-center gap-2">
                        AI Assistant
                        <span className="bg-primary text-primary-foreground text-[10px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wide">Constrained</span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Grounded strictly in approved themes.</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="bg-secondary p-3 rounded-lg text-sm border border-border shadow-sm">
                        <p>Hi, I am constrained only to your approved codebook and verified excerpts. What would you like to draft?</p>
                    </div>

                    <div className="bg-primary/5 p-3 rounded-lg text-sm border border-primary/20 self-end shadow-sm">
                        <p>Generate a summary paragraph for section 1.2 "Coping Strategies". Focus on physical isolation.</p>
                    </div>

                    <div className="bg-secondary p-3 rounded-lg text-sm border border-border shadow-sm">
                        <p className="mb-2">Here is a draft based exclusively on approved findings:</p>
                        <p className="italic bg-background p-2 rounded border border-input text-foreground">
                            Teachers frequently deploy physical isolation as a primary coping mechanism responding to systemic overload. Seeking out solitary environments, such as functioning from their cars during lunch breaks, serves as a necessary micro-intervention to achieve temporary sensory deprivation and enforce boundaries against constant administrative demands.
                        </p>
                        <div className="mt-3 flex gap-2">
                            <button className="flex-1 bg-primary text-primary-foreground text-xs font-semibold py-1.5 rounded hover:bg-primary/90 transition-colors">
                                Insert into Report
                            </button>
                            <button className="bg-background border border-input text-xs font-semibold py-1.5 px-3 rounded hover:bg-accent transition-colors">
                                Rewrite
                            </button>
                        </div>
                        <div className="mt-3 pt-3 border-t border-border/50">
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg>
                                100% grounded in 3 approved codes.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-border bg-card">
                    <div className="relative">
                        <textarea
                            className="w-full text-sm p-2 rounded border border-input bg-background min-h-[80px]"
                            placeholder="Ask the assistant to draft, compare, or rewrite..."
                        ></textarea>
                        <button className="absolute bottom-2 right-2 bg-primary text-primary-foreground p-1 rounded hover:bg-primary/90">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    );
}
