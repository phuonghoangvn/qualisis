import React from 'react';

const RAW_CODES = [
    { id: '1', name: 'Somatic Experiencing of Burnout', freq: 4, origin: 'AI Suggested', status: 'Under Review', theme: 'Unassigned' },
    { id: '2', name: 'Administrative Burden', freq: 12, origin: 'Human', status: 'Approved', theme: 'Systemic Pressures' },
    { id: '3', name: 'Isolation as Coping Mechanism', freq: 3, origin: 'AI Suggested', status: 'Approved', theme: 'Coping Strategies' },
    { id: '4', name: 'Physical Stress Symptoms', freq: 2, origin: 'AI Suggested', status: 'Merged', theme: 'N/A' },
];

const CLEAN_CODES = [
    { id: '101', name: 'Administrative Burden', definition: 'Mentions of paperwork, grading demands, or principal requests outside of teaching hours.', theme: 'Systemic Pressures', mapped: 3 },
    { id: '102', name: 'Isolation & Withdrawal', definition: 'Seeking physical boundaries or sensory deprivation to escape professional demands.', theme: 'Coping Strategies', mapped: 2 },
];

export default function CodebookPage({ searchParams }: { searchParams: { tab?: string } }) {
    const activeTab = searchParams.tab === 'clean' ? 'clean' : 'raw';

    return (
        <div className="flex-1 flex overflow-hidden">
            {/* Center Panel */}
            <div className="flex-1 flex flex-col bg-background border-r border-border">
                <header className="p-4 border-b border-border bg-card">
                    <h2 className="text-2xl font-bold tracking-tight mb-4">Codebook</h2>

                    <div className="flex space-x-1 border-b border-border">
                        <a href="?tab=raw" className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === 'raw' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                            Raw Codebook
                        </a>
                        <a href="?tab=clean" className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === 'clean' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                            Clean Codebook
                        </a>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
                    {activeTab === 'raw' ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-card p-4 rounded-lg shadow-sm border border-border">
                                <span className="text-sm font-medium">Filter by Status:</span>
                                <select className="border border-input bg-background rounded-md text-sm p-1.5 focus:outline-none focus:ring-2 focus:ring-ring">
                                    <option>All Statuses</option>
                                    <option>Approved</option>
                                    <option>Under Review</option>
                                    <option>Merged</option>
                                </select>
                            </div>

                            <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm shadow-sm">
                                <table className="min-w-full divide-y divide-border">
                                    <thead className="bg-muted">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Code Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Freq</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Origin</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tentative Theme</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border text-sm">
                                        {RAW_CODES.map(code => (
                                            <tr key={code.id} className="hover:bg-accent/50 cursor-pointer transition-colors">
                                                <td className="px-6 py-4 font-medium">{code.name}</td>
                                                <td className="px-6 py-4">{code.freq}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${code.origin === 'AI Suggested' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                                                        {code.origin}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">{code.status}</td>
                                                <td className="px-6 py-4 text-muted-foreground">{code.theme}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {CLEAN_CODES.map(code => (
                                <div key={code.id} className="bg-card border border-border p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold tracking-tight">{code.name}</h3>
                                            <p className="text-sm text-primary font-medium mt-1">Theme: {code.theme}</p>
                                        </div>
                                        <div className="bg-accent text-accent-foreground px-3 py-1 rounded-full text-xs font-semibold">
                                            {code.mapped} Raw Codes Mapped
                                        </div>
                                    </div>

                                    <div className="space-y-2 mt-4 text-sm text-foreground">
                                        <p className="font-semibold text-muted-foreground uppercase tracking-wider text-xs">Definition</p>
                                        <p>{code.definition}</p>
                                    </div>

                                    <div className="flex gap-2 mt-6">
                                        <button className="text-xs px-3 py-1.5 border border-input rounded hover:bg-accent font-medium">View Evidence</button>
                                        <button className="text-xs px-3 py-1.5 border border-input rounded hover:bg-accent font-medium">Edit Mapping</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: AI Support for Codebook */}
            <aside className="w-80 bg-card border-l border-border flex flex-col">
                <div className="p-4 border-b border-border">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        AI Assistant
                        <span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wide">Beta</span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Codebook Optimization</p>
                </div>

                <div className="p-4 space-y-6 overflow-y-auto">
                    {activeTab === 'raw' ? (
                        <>
                            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                                <h4 className="font-semibold text-sm mb-2 text-primary">Duplicate Warning</h4>
                                <p className="text-xs text-muted-foreground mb-3">
                                    I noticed overlap between <strong>Somatic Experiencing of Burnout</strong> and <strong>Physical Stress Symptoms</strong> based on their supporting quotes.
                                </p>
                                <button className="w-full bg-background border border-border py-1.5 text-xs font-semibold rounded hover:bg-accent transition-colors">
                                    Review Merge Suggestion
                                </button>
                            </div>

                            <div className="bg-secondary p-4 rounded-lg border border-border">
                                <h4 className="font-semibold text-sm mb-2">Clustering Hint</h4>
                                <p className="text-xs text-muted-foreground mb-3">
                                    You have 7 codes that appear frequently within the same interview segments. They might form a new meta-theme around <em>Professional Identity Crisis</em>.
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="bg-secondary p-4 rounded-lg border border-border">
                            <h4 className="font-semibold text-sm mb-2">Code Cleanliness Score</h4>
                            <p className="text-xs text-muted-foreground mb-3">
                                Your clean codebook has high distinctiveness. No major overlapping definitions detected.
                            </p>
                            <div className="w-full bg-muted rounded-full h-2 mb-2">
                                <div className="bg-green-500 h-2 rounded-full" style={{ width: '92%' }}></div>
                            </div>
                            <span className="text-xs font-medium">92 / 100</span>
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}
