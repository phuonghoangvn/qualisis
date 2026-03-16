import { notFound } from "next/navigation"

// Fallback Mock Data in case DB is not running
const MOCK_TRANSCRIPT = {
    id: "1",
    title: "P1 - High School Math Teacher",
    content: `Interviewer: Thank you for speaking with me today. Could you tell me about a time recently when you felt particularly overwhelmed?
Participant: Well, last Tuesday was a nightmare. I had three students absent who needed makeup packets, my principal asked for the quarter grades early, and then during my prep period, a parent called to complain about a B minus. I just felt this deep sense of exhaustion where my chest gets tight. It's like no matter how much I prep, the expectations just keep shifting.
Interviewer: How did you handle that feeling in the moment?
Participant: Honestly, I went to my car during lunch and just sat in silence for 15 minutes. It's the only place where no one needs anything from me. You learn these little micro-coping strategies to survive till Friday.`,
    segments: [
        {
            id: "seg_1",
            startIndex: 111,
            endIndex: 334,
            text: "Well, last Tuesday was a nightmare. I had three students absent who needed makeup packets, my principal asked for the quarter grades early, and then during my prep period, a parent called to complain about a B minus.",
        },
        {
            id: "seg_2",
            startIndex: 335,
            endIndex: 404,
            text: "I just felt this deep sense of exhaustion where my chest gets tight.",
        },
        {
            id: "seg_3",
            startIndex: 677,
            endIndex: 746,
            text: "You learn these little micro-coping strategies to survive till Friday.",
        }
    ]
};

const MOCK_SUGGESTIONS = [
    {
        id: "sug_1",
        segmentId: "seg_2",
        label: "Somatic Experiencing of Burnout",
        explanation: "The participant explicitly links emotional exhaustion to a physical sensation ('chest gets tight'), indicating somatic symptoms of occupational stress.",
        confidence: "HIGH",
        alternatives: ["Emotional Exhaustion", "Physical Stress Symptoms"],
        uncertainty: "The phrase 'deep sense of exhaustion' is clear, but 'chest gets tight' could also relate to anxiety or panic. Proceed with somatic code.",
        promptVersion: "v1.4-qual-coder",
        modelProvider: "GPT-4-Turbo",
        status: "SUGGESTED"
    }
];

export default async function TranscriptPage({ params }: { params: { transcriptId: string } }) {
    // In a real app, fetch from Prisma:
    // const transcript = await prisma.transcript.findUnique(...) 
    const transcript = MOCK_TRANSCRIPT;
    const suggestions = MOCK_SUGGESTIONS;

    if (!transcript) notFound();

    return (
        <div className="flex-1 flex overflow-hidden">
            {/* Center Panel: Transcript Workspace */}
            <div className="flex-1 flex flex-col bg-background border-r border-border min-w-[500px]">
                <header className="p-4 border-b border-border flex justify-between items-center bg-card">
                    <div>
                        <h2 className="font-semibold text-lg">{transcript.title}</h2>
                        <p className="text-sm text-muted-foreground">Status: Analyzing</p>
                    </div>
                    <div className="flex gap-2">
                        <button className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-accent font-medium">
                            Export
                        </button>
                        <button className="text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium">
                            Run AI Coder (v1.4)
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 relative">
                    <div className="max-w-3xl mx-auto text-lg leading-relaxed text-slate-800 dark:text-slate-200">
                        {/* Very naive highlighting for prototype purposes */}
                        {transcript.content.split('\n').map((line, i) => {
                            if (line.startsWith('Interviewer:')) {
                                return <p key={i} className="mb-6 font-medium text-slate-500">{line}</p>;
                            }

                            // Mock highlight rendering
                            if (line.includes('deep sense of exhaustion where my chest gets tight')) {
                                const parts = line.split('I just felt this deep sense of exhaustion where my chest gets tight.');
                                return (
                                    <p key={i} className="mb-6">
                                        {parts[0]}
                                        <span
                                            className="transcript-highlight active px-1 rounded"
                                            title="AI Suggestion: Somatic Experiencing of Burnout"
                                        >
                                            I just felt this deep sense of exhaustion where my chest gets tight.
                                        </span>
                                        {parts[1]}
                                    </p>
                                )
                            }

                            return <p key={i} className="mb-6">{line}</p>;
                        })}
                    </div>
                </div>
            </div>

            {/* Right Panel: Traceable AI Support */}
            <aside className="w-96 bg-card flex flex-col overflow-y-auto">
                <div className="p-4 border-b border-border sticky top-0 bg-card z-10">
                    <h3 className="font-semibold">AI Suggestion Detail</h3>
                    <p className="text-xs text-muted-foreground mt-1">Traceability Inspector</p>
                </div>

                <div className="p-4 space-y-6">
                    <div className="space-y-4">
                        <div className="p-4 border border-border rounded-lg bg-background shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    {suggestions[0].confidence} Confidence
                                </span>
                                <span className="text-xs text-muted-foreground">{suggestions[0].status}</span>
                            </div>

                            <h4 className="font-bold text-lg mb-2">{suggestions[0].label}</h4>
                            <p className="text-sm text-foreground mb-4">{suggestions[0].explanation}</p>

                            <div className="text-sm bg-muted p-2 rounded mb-4 italic border-l-2 border-primary">
                                "...deep sense of exhaustion where my chest gets tight."
                            </div>

                            <div className="space-y-2 mt-4 pt-4 border-t border-border">
                                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Uncertainty Note</h5>
                                <p className="text-xs text-muted-foreground">{suggestions[0].uncertainty}</p>
                            </div>

                            <div className="space-y-2 mt-4 pt-4 border-t border-border">
                                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alternatives</h5>
                                <div className="flex flex-wrap gap-2">
                                    {suggestions[0].alternatives.map((alt, idx) => (
                                        <span key={idx} className="text-xs border border-border px-2 py-1 rounded bg-accent text-accent-foreground cursor-pointer hover:bg-accent/80">
                                            {alt}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-border space-y-2">
                                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Audit Metadata</h5>
                                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                    <div>Model: {suggestions[0].modelProvider}</div>
                                    <div>Prompt: {suggestions[0].promptVersion}</div>
                                </div>
                            </div>

                            <div className="mt-6 flex flex-col gap-2">
                                <input
                                    type="text"
                                    placeholder="Researcher note... (optional)"
                                    className="w-full text-sm p-2 rounded border border-input bg-transparent"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <button className="bg-primary text-primary-foreground text-sm font-medium py-2 rounded-md hover:bg-primary/90 transition-colors">
                                        Accept
                                    </button>
                                    <button className="bg-destructive text-destructive-foreground text-sm font-medium py-2 rounded-md hover:bg-destructive/90 transition-colors">
                                        Reject
                                    </button>
                                    <button className="border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium py-2 rounded-md transition-colors">
                                        Modify
                                    </button>
                                    <button className="border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium py-2 rounded-md transition-colors">
                                        Merge
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </aside>
        </div>
    )
}
