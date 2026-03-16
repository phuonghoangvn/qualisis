import React from 'react';

export default function SettingsPage() {
    return (
        <div className="flex-1 flex flex-col p-8 bg-muted/20 overflow-y-auto w-full">
            <div className="max-w-4xl w-full mx-auto">
                <h1 className="text-2xl font-bold tracking-tight mb-6">Settings & Policies</h1>

                <div className="space-y-8">
                    {/* AI Settings */}
                    <section className="bg-card rounded-lg border border-border shadow-sm p-6">
                        <h2 className="text-lg font-semibold mb-4 border-b border-border pb-2">AI Configuration</h2>

                        <div className="space-y-4 max-w-xl">
                            <div>
                                <label className="block text-sm font-medium mb-1">Provider Selection</label>
                                <select className="w-full border border-input bg-background rounded-md text-sm p-2">
                                    <option>OpenAI (GPT-4-Turbo)</option>
                                    <option>Anthropic (Claude 3 Opus)</option>
                                    <option>Local (Llama 3 / Ollama) - Privacy Mode</option>
                                </select>
                                <p className="text-xs text-muted-foreground mt-1">Select the LLM backing the researcher assistant.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Traceability Stringency</label>
                                <select className="w-full border border-input bg-background rounded-md text-sm p-2">
                                    <option>Strict (Block report drafting if unapproved codes present)</option>
                                    <option>Moderate (Warn if unapproved codes present)</option>
                                    <option>Relaxed</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 mt-4">
                                <input type="checkbox" id="auto_finalize" disabled className="rounded border-input text-primary focus:ring-primary" />
                                <label htmlFor="auto_finalize" className="text-sm font-medium text-muted-foreground line-through">
                                    Allow AI to auto-finalize codes without human review
                                </label>
                                <span className="text-xs text-destructive ml-2 font-semibold">Disabled by Policy</span>
                            </div>
                        </div>
                    </section>

                    {/* Access Control */}
                    <section className="bg-card rounded-lg border border-border shadow-sm p-6">
                        <h2 className="text-lg font-semibold mb-4 border-b border-border pb-2">Team & Roles</h2>

                        <table className="w-full text-sm mt-4 text-left">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="pb-2 font-medium">Name</th>
                                    <th className="pb-2 font-medium">Role</th>
                                    <th className="pb-2 font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                <tr>
                                    <td className="py-3">Dr. Jane Smith</td>
                                    <td>Admin / Researcher</td>
                                    <td><button className="text-primary hover:underline font-medium">Edit</button></td>
                                </tr>
                                <tr>
                                    <td className="py-3">Dr. John Doe</td>
                                    <td>Reviewer (Audit Only)</td>
                                    <td><button className="text-primary hover:underline font-medium">Edit</button></td>
                                </tr>
                            </tbody>
                        </table>

                        <button className="mt-4 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium">
                            Invite Member
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );
}
