import React from 'react';

const MOCK_AUDIT_LOGS = [
    { id: '1', date: '2023-11-01 14:32:10', user: 'Dr. Jane Smith', action: 'Accepted AI Suggestion', entity: 'Code: Somatic Experiencing', details: 'Added to Segment 2 (P1). Confidence: HIGH.' },
    { id: '2', date: '2023-11-01 14:35:44', user: 'Dr. Jane Smith', action: 'Modified AI Suggestion', entity: 'Code: Isolation as Coping', details: 'Changed label from "Avoidance Behavior" to "Isolation as Coping Mechanism" to better reflect agency.' },
    { id: '3', date: '2023-11-02 09:15:00', user: 'System (AI Coder v1.4)', action: 'Generated Initial Codes', entity: 'Transcript: P1', details: 'Processed 5 segments. Suggested 8 codes. Model: GPT-4-Turbo.' },
    { id: '4', date: '2023-11-03 11:20:00', user: 'Dr. John Doe (Reviewer)', action: 'Reviewed Traceability', entity: 'Theme: Systemic Pressures', details: 'Verified 24 evidence spans. Marked theme as APPROVED.' },
];

export default function AuditTrailPage() {
    return (
        <div className="flex-1 flex flex-col p-8 bg-muted/20 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
                    <p className="text-sm text-muted-foreground mt-1">Immutable log of AI generation and human review decisions.</p>
                </div>
                <button className="bg-background border border-border text-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                    Export Log (CSV)
                </button>
            </div>

            <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border bg-muted flex items-center gap-4">
                    <input type="text" placeholder="Filter logs..." className="flex-1 text-sm p-2 rounded border border-input bg-background" />
                    <select className="border border-input bg-background rounded-md text-sm p-2 focus:outline-none focus:ring-2 focus:ring-ring">
                        <option>All Actions</option>
                        <option>AI Generation</option>
                        <option>Human Review</option>
                        <option>Modifications</option>
                    </select>
                </div>

                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-card">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timestamp</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">User / Agent</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entity affected</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-sm">
                        {MOCK_AUDIT_LOGS.map(log => (
                            <tr key={log.id} className="hover:bg-accent/30 transition-colors">
                                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{log.date}</td>
                                <td className="px-6 py-4 font-medium flex items-center gap-2">
                                    {log.user.includes('System') ? (
                                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                                    ) : (
                                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                                    )}
                                    {log.user}
                                </td>
                                <td className="px-6 py-4 font-semibold">{log.action}</td>
                                <td className="px-6 py-4">{log.entity}</td>
                                <td className="px-6 py-4 text-muted-foreground">{log.details}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
