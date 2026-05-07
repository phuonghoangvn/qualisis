'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Bot, Library, Trash2, AlertCircle, User, X } from 'lucide-react'

// Enhanced markdown renderer to support tables and better styling
function renderMarkdown(md: string): string {
    let html = md;

    // Parse Tables
    html = html.replace(/(?:^\|.+\|[\r\n]*)+/gm, (match) => {
        const lines = match.trim().split('\n');
        let tableHtml = '<div class="overflow-x-auto my-4 shadow-sm ring-1 ring-slate-200 sm:rounded-lg"><table class="min-w-full divide-y divide-slate-200">';
        
        lines.forEach((line, i) => {
            if (line.includes('---')) return; // skip separator line
            
            const cells = line.split('|').map(c => c.trim());
            if (cells[0] === '') cells.shift();
            if (cells[cells.length - 1] === '') cells.pop();
            
            if (i === 0) {
                tableHtml += '<thead class="bg-slate-50 border-b border-slate-200"><tr>';
                cells.forEach(c => tableHtml += `<th class="px-4 py-3 text-left text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">${c}</th>`);
                tableHtml += '</tr></thead><tbody class="divide-y divide-slate-100 bg-white">';
            } else {
                tableHtml += '<tr class="hover:bg-slate-50/50 transition-colors">';
                cells.forEach(c => tableHtml += `<td class="px-4 py-3 text-[13px] text-slate-700 leading-relaxed align-top">
                    ${c.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code class="bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded text-[0.85em] border border-indigo-100">$1</code>')}
                </td>`);
                tableHtml += '</tr>';
            }
        });
        tableHtml += '</tbody></table></div>';
        return tableHtml;
    });

    // Parse Headers, Bold, Italic, Code, Lists, and Paragraphs
    html = html
        .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-slate-800 mt-4 mb-2">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 class="text-base font-extrabold text-slate-800 mt-5 mb-2">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 class="text-lg font-black text-slate-900 mt-6 mb-3">$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Only apply inline code if not already in a table cell (table cells did it manually above)
        .replace(/(?<!<td[^>]*>.*)`([^`]+)`(?!.*<\/td>)/g, '<code class="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md text-[0.85em] font-mono border border-slate-200">$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-indigo-600 hover:text-indigo-800 underline decoration-indigo-200 underline-offset-2 font-medium bg-indigo-50/50 px-1 py-0.5 rounded transition-colors">$1</a>')
        .replace(/^- (.+)$/gm, '<li class="ml-4 mb-1">$1</li>')
        .replace(/(<li.*<\/li>\n?)+/g, (block) => `<ul class="list-disc mb-4 text-[13px] text-slate-700">${block}</ul>`)
        // Wrap non-HTML lines in paragraph
        .replace(/^(?!<).+$/gm, (line) => line.trim() ? `<p class="mb-3 text-[13px] leading-relaxed text-slate-700">${line}</p>` : '');

    return html;
}

export default function ChatPage({ params }: { params: { projectId: string } }) {
    const [messages, setMessages] = useState<{role: string, content: string}[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showHandbook, setShowHandbook] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Load initial chat history
    useEffect(() => {
        fetch(`/api/projects/${params.projectId}/chat`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setMessages(data)
                }
            })
            .catch(err => console.error('Failed to load chat history', err))
    }, [params.projectId])

    const clearChat = async () => {
        if (window.confirm('Are you sure you want to clear this conversation?')) {
            setMessages([])
            try {
                await fetch(`/api/projects/${params.projectId}/chat`, { method: 'DELETE' })
            } catch (err) {
                console.error('Failed to clear chat history from server', err)
            }
        }
    }

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!input.trim() || isLoading) return

        setIsLoading(true)
        setError(null)

        const finalContent = input.trim()
        const userMsg = { role: 'user', content: finalContent }
        setMessages(prev => [...prev, userMsg])
        setInput('')

        try {
            const res = await fetch(`/api/projects/${params.projectId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [...messages, userMsg] })
            })

            if (!res.ok) throw new Error('Failed to get AI response')
            const data = await res.json()
            
            setMessages(prev => [...prev, data])
        } catch (err: any) {
            setError(err.message || 'An error occurred')
            // Remove user message if failed
            setMessages(prev => prev.slice(0, -1))
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }
    
    const promptCategories: { phase: string; isHero?: boolean; prompts: { title: string; prompt: string }[] }[] = [
        {
            phase: "⚡ Full RTA Pipeline (All 6 Phases)",
            isHero: true,
            prompts: [
                {
                    title: "Complete Analysis: Familiarize → Report",
                    prompt: `Role:\nYou are a world-class qualitative research methodologist specializing in Braun & Clarke's Reflexive Thematic Analysis (RTA). You are rigorous, systematic, and data-driven. You will now perform a complete thematic analysis of the transcript provided, walking through all 6 official phases in order.\n\nContext:\nThe project context (codebook, datasets) has already been provided to you. The transcript excerpt to analyze is pasted below in the Data section. Do NOT skip any phase.\n\nTask:\nPerform a full Reflexive Thematic Analysis of the data below, structured across exactly 6 phases.\n\n---\n\n## Phase 1: Familiarize with Data\nProvide a brief narrative (3-4 sentences) summarizing your first impressions of the participant's tone, emotional state, and key recurring topics. Do not code yet.\n\n## Phase 2: Generate Initial Codes\nProduce a Markdown table with 3 columns: [Suggested Code] | [Brief Definition] | [Verbatim Quote Evidence].\nRules: Use "in vivo" codes (participant's own words) where possible. Every code MUST have a verbatim quote.\n\n## Phase 3: Search for Themes\nGroup your Phase 2 codes into 3–4 overarching candidate themes. For each theme, list its associated codes and write 2 sentences explaining the central organizing concept.\n\n## Phase 4: Review Themes\nCritically evaluate each candidate theme. For each, note: (a) Does it hold up against the data? (b) Are there any negative cases or contradictions? Suggest refinements.\n\n## Phase 5: Define & Name Themes\nAssign a final, evocative, academically rigorous name to each reviewed theme. Write a concise 2-sentence formal academic definition per theme.\n\n## Phase 6: Produce the Report\nWrite a 300-400 word academic narrative findings section. Weave in at least 3 verbatim quotes as embedded evidence (not as a list). Maintain an objective, empathetic, and scholarly tone.\n\n---\n\nConstraints (CRITICAL):\n- You MUST complete all 6 phases. Do not stop early.\n- Never paraphrase participant quotes. Always use exact verbatim text.\n- Do not import external theory — reason only from the data provided.\n\nData:\n"\n[paste your transcript excerpt here]\n"`
                }
            ]
        },
        {
            phase: "🔍 Phase 1: Familiarization & Summarization",
            prompts: [
                { 
                    title: "Extract Initial Impressions", 
                    prompt: `Role: \nYou are a sharp and observant qualitative research assistant immersing yourself in new data. You are sensitive to emotional nuances, repeated phrases, and overarching contextual challenges.\n\nContext: \nI am in Phase 1 (Familiarization). I need to get a high-level sense of the data before doing line-by-line coding.\n\nTask: \nRead the provided raw transcript. Summarize your first impressions regarding the participant's tone, core struggles, and any striking metaphors.\n\nConstraints:\n- Maintain neutrality. Do not construct themes yet.\n- Focus purely on "what is happening" rather than imposing theoretical meaning.\n\nOutput: \nA brief narrative summary paragraph, followed by a bulleted list of 3 key impressions with exactly one short verbatim quote for each.` 
                },
                { 
                    title: "Participant Persona Generation", 
                    prompt: `Role: \nYou are an empathetic ethnographic researcher.\n\nContext: \nI need a quick summary profile of the participant based purely on how they speak and what they emphasize in the interview.\n\nTask: \nBuild a "Participant Persona" from the data. Detail their apparent motivations, pain points, and worldview.\n\nConstraints:\n- Anchor all claims in the text.\n- Note explicitly if the participant's attitude shifts during the interview.\n\nOutput: \nA structured markdown profile: [Background/Context] | [Core Motivations] | [Pain Points] | [Defining Quote].` 
                },
                { 
                    title: "Identify Tensions and Contradictions", 
                    prompt: `Role: \nYou are a critical discourse analyst.\n\nContext: \nOften the most interesting qualitative insights come from where a participant contradicts themselves or expresses cognitive dissonance.\n\nTask: \nRead the transcript and identify any internal contradictions, hesitations, or conflicting feelings the participant expresses.\n\nConstraints:\n- Do not judge the participant. Frame contradictions as complex human experiences.\n- You must provide the exact conflicting quotes side-by-side.\n\nOutput: \nA list of identified tensions. Format: Tension Name -> Quote A vs Quote B -> Analytical Note.` 
                }
            ]
        },
        {
            phase: "🏷️ Phase 2: Generating Initial Codes",
            prompts: [
                { 
                    title: "Inductive Open Coding (Line-by-Line)", 
                    prompt: `Role: \nYou are a meticulous qualitative research assistant performing inductive "open coding."\n\nContext: \nI am generating initial codes from raw data. Do not generate overarching themes yet.\n\nTask: \nCarefully read the text. Identify meaningful segments and generate codes. A code is a short, precise label (1-4 words) that captures the core meaning.\n\nConstraints:\n- Data-Driven Only: The codes must emerge organically.\n- Embrace "In Vivo" Codes: Use the participant's exact words whenever possible.\n- Verbatim Evidence: For every code, provide the exact verbatim quote.\n\nOutput: \nMarkdown table with 3 columns: [Suggested Code] | [Brief Definition] | [Verbatim Quote Evidence]` 
                },
                { 
                    title: "Action / Process Coding", 
                    prompt: `Role: \nYou are a researcher employing Grounded Theory techniques, specifically "Process Coding" (using gerunds/verbs ending in -ing).\n\nContext: \nI want to focus on actions, processes, and changes over time in the participant's narrative rather than static states.\n\nTask: \nCode the transcript using strictly "-ing" words (e.g., "Struggling with management", "Navigating the system").\n\nConstraints:\n- Every code must begin with a gerund (-ing verb).\n- Keep the codes grounded in the participant's actual actions.\n\nOutput: \nBulleted list of Process Codes, each followed by a representative verbatim quote.` 
                },
                { 
                    title: "Emotion / Affect Coding", 
                    prompt: `Role: \nYou are an empathetic psychological researcher.\n\nContext: \nI want to isolate the emotional landscape of the participant's experience.\n\nTask: \nScan the data specifically for expressions of emotion, affect, mood, or somatic feelings.\n\nConstraints:\n- Look for implicit emotions (sighs, hesitations, metaphors) as well as explicit feeling words.\n- Code the emotion and what triggered it.\n\nOutput: \nTable: [Emotion Code] | [Trigger/Context] | [Verbatim Quote]` 
                }
            ]
        },
        {
            phase: "🧩 Phase 3 & 4: Theme Generation & Review",
            prompts: [
                { 
                    title: "Cluster Codes into Themes", 
                    prompt: `Role: \nYou are a senior qualitative methodologist skilled in finding macro-patterns.\n\nContext: \nI have a list of initial codes. I need to cluster them into candidate themes based on shared meaning.\n\nTask: \nReview the provided list of codes. Group them into 3 to 4 overarching candidate themes. \n\nConstraints:\n- Ensure themes are conceptually distinct.\n- Explain *why* these codes belong together logically (the Central Organizing Concept).\n- Do not force outliers into themes.\n\nOutput: \nFor each theme: 1. Theme Name (Bold), 2. Central Concept (1-2 sentences), 3. List of Associated Codes.` 
                },
                { 
                    title: "Thematic Peer Review (Devil's Advocate)", 
                    prompt: `Role: \nYou are a rigorous ethnographic peer reviewer.\n\nContext: \nI have candidate themes and I need to ensure they hold up against the empirical data and are not too thin or descriptive.\n\nTask: \nCritically review my overarching themes. Identify weaknesses, conceptual overlaps, anomalies, or areas lacking depth.\n\nConstraints:\n- Be constructively critical. Do not just agree with me.\n- Point out if a theme seems too broad (a "topic" like "Challenges") rather than a true meaning-based theme.\n\nOutput: \nA Markdown table: [Theme] | [Strengths] | [Critiques/Weaknesses] | [Suggested Refinement]` 
                }
            ]
        },
        {
            phase: "✒️ Phase 5: Naming & Defining Themes",
            prompts: [
                { 
                    title: "Theme Refinement & Naming", 
                    prompt: `Role: \nYou are a master academic storyteller and qualitative writer.\n\nContext: \nMy theme names feel too generic, flat, or descriptive (e.g., "Communication Issues").\n\nTask: \nReview the provided theme descriptions and associated codes. Suggest 3 alternative, conceptually rich, and evocative names for each theme.\n\nConstraints:\n- Avoid generic one-word topics.\n- Use active, narrative-driven language (e.g., "The Silence of Unspoken Expectations").\n- Ensure the names accurately reflect the codes within them.\n\nOutput: \nBulleted list presenting 3 naming options per theme, followed by a suggested 2-sentence formal academic definition.` 
                },
                { 
                    title: "Generate Theme Memo", 
                    prompt: `Role: \nYou are an analytical researcher writing memos.\n\nContext: \nI need to write an analytical memo documenting the evolution and core boundaries of a specific theme.\n\nTask: \nWrite a comprehensive memo for the provided theme. Explain what the theme IS and what the theme IS NOT.\n\nConstraints:\n- Clearly establish the boundaries of the theme (inclusion/exclusion criteria).\n- Discuss how this theme relates to the broader research question.\n\nOutput: \nA structured memo: [Theme Name] | [Core Definition] | [Inclusion Criteria] | [Exclusion Criteria] | [Analytic Notes].` 
                }
            ]
        },
        {
            phase: "📝 Phase 6: Reporting & Writing",
            prompts: [
                { 
                    title: "Draft Narrative Findings Section", 
                    prompt: `Role: \nYou are an accomplished qualitative researcher drafting the findings section of a peer-reviewed journal article.\n\nContext: \nI need to transform my thematic structures and quotes into a compelling narrative.\n\nTask: \nWrite a 300-400 word narrative section for the theme provided. Use the provided quotes to build a rich, "thick description".\n\nConstraints:\n- Do not just list quotes. The quotes must be embedded inside the sentences to illustrate your analytical points (e.g., Participant A felt "completely overwhelmed" by the process).\n- Maintain an objective, empathetic, and scholarly tone.\n\nOutput: \nA continuous, well-structured academic narrative paragraph/section.` 
                },
                { 
                    title: "Synthesize Executive Summary", 
                    prompt: `Role: \nYou are a UX/Applied Researcher communicating findings to stakeholders.\n\nContext: \nI need to translate academic qualitative themes into an actionable, easy-to-read executive summary.\n\nTask: \nTake my themes and quotes and write a 1-page executive summary highlighting key insights and potential action areas.\n\nConstraints:\n- Remove heavy academic jargon.\n- Focus on "So What?" (Why does this insight matter?).\n- Use bullet points for readability.\n\nOutput: \nA business-friendly summary: [High-Level TL;DR] | [3 Key Insights w/ Evidence] | [Implications/Recommendations].` 
                }
            ]
        },
        {
            phase: "🧠 Advanced & Cross-Case Analysis",
            prompts: [
                { 
                    title: "Cross-Case Comparison", 
                    prompt: `Role: \nYou are a comparative qualitative analyst.\n\nContext: \nI need to understand how different groups of participants (or different specific transcripts) diverge on a single topic.\n\nTask: \nCompare and contrast how [Topic/Theme] is experienced across the provided data sources.\n\nConstraints:\n- Highlight both shared commonalities and stark divergences.\n- Cite which participant/transcript holds which view.\n\nOutput: \nA comparative analysis matrix (table) followed by a paragraph summarizing the core divergences.` 
                },
                { 
                    title: "Codebook Deduplication & Refinement", 
                    prompt: `Role: \nYou are a data taxonomist and qualitative coder.\n\nContext: \nMy codebook has grown too large, messy, and contains overlapping codes.\n\nTask: \nReview the provided list of codes. Identify overlaps, synonyms, and redundancies. Propose a cleaner, hierarchical codebook structure (Categories -> Sub-codes).\n\nConstraints:\n- Do not delete meaning; merge similar codes into a broader category.\n- Provide a brief rationale for your merges.\n\nOutput: \nA structured markdown hierarchy (Level 1 Category -> Level 2 Codes), plus a list of suggested merges.` 
                }
            ]
        }
    ]

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            {/* Main content div since Sidebar is inherited from layout */}
            <div className="flex-1 flex flex-col h-full relative">
                <div className="h-16 border-b border-slate-200/60 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 flex-shrink-0 sticky top-0 z-10 w-full">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">Chat with Data</h2>
                            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">AI Research Copilot</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowHandbook(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-100/50 rounded-lg text-[12px] font-bold text-indigo-700 hover:bg-indigo-100 transition-all shadow-sm"
                        >
                            <Library className="w-4 h-4" /> Prompt Handbook
                        </button>
                        {messages.length > 0 && (
                            <button
                                onClick={clearChat}
                                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all shadow-sm"
                            >
                                <Trash2 className="w-4 h-4" /> Clear
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="max-w-3xl mx-auto flex flex-col gap-6">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full mt-24 text-center animate-[fade-in-up_0.5s_ease-out_both] px-4">
                                <div className="w-20 h-20 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                                    <Bot className="w-10 h-10 text-indigo-500" />
                                </div>
                                <h3 className="text-2xl font-extrabold text-slate-800 mb-2">Your Data is Pre-Loaded & Ready!</h3>
                                <p className="text-slate-500 max-w-lg font-medium text-sm mb-10">
                                    I have automatically memorized all your transcripts, codebook, and themes in this project. You don't need to attach any files. Try out some of my core capabilities:
                                </p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full text-left">
                                    {[
                                        {
                                            title: "🔍 Full-Text Search & Synthesis",
                                            prompt: "What are the most common challenges participants mention across all transcripts?"
                                        },
                                        {
                                            title: "🔗 Clickable Quote Traceability",
                                            prompt: "Find exact quotes where participants talk about feeling overwhelmed. (Click the blue links in my response to jump to the source!)"
                                        },
                                        {
                                            title: "🧠 Thematic Comparison",
                                            prompt: "Are there any differences or tensions between how different participants describe their coping strategies?"
                                        },
                                        {
                                            title: "📖 Prompt Handbook",
                                            prompt: "Review my codebook. Which themes have the strongest supporting evidence in the data, and which are lacking?"
                                        }
                                    ].map((suggestion, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                setInput(suggestion.prompt)
                                                inputRef.current?.focus()
                                            }}
                                            className="bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm p-4 rounded-xl transition-all group flex flex-col gap-1 items-start text-left"
                                        >
                                            <span className="text-[13px] font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{suggestion.title}</span>
                                            <span className="text-[11px] font-medium text-slate-400 line-clamp-2">{suggestion.prompt}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            messages.map((msg, idx) => (
                                <div key={idx} className={`flex gap-4 animate-[fade-in-up_0.3s_ease-out_both] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`w-10 h-10 rounded-full flex items-center flex-shrink-0 justify-center shadow-sm ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white'}`}>
                                        {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                                    </div>
                                    <div className={`max-w-[75%] p-5 rounded-2xl ${msg.role === 'user' ? 'bg-white border border-slate-200 shadow-sm' : 'bg-indigo-50 border border-indigo-100'}`}>
                                        {msg.role === 'user' ? (
                                            <p className="text-slate-800 text-sm font-medium whitespace-pre-wrap">{msg.content}</p>
                                        ) : (
                                            <div 
                                                className="prose prose-sm prose-slate max-w-none text-slate-800 prose-headings:font-bold prose-a:text-indigo-600 leading-relaxed"
                                                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                            />
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        
                        {isLoading && (
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                                    <Bot className="w-5 h-5" />
                                </div>
                                <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl flex items-center gap-2">
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input Area */}
                <div className="p-6 bg-white border-t border-slate-200/60 sticky bottom-0 z-10 shadow-[0_-10px_30px_rgb(0,0,0,0.02)]">
                    <div className="max-w-3xl mx-auto">
                        {error && (
                            <div className="mb-3 px-4 py-2 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-600 text-xs font-semibold">
                                <AlertCircle className="w-4 h-4" /> {error}
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all shadow-inner">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Message your Research Copilot (Press Enter to send, Shift+Enter for new line)..."
                                className="flex-1 bg-transparent border-none focus:outline-none p-3 text-sm text-slate-800 placeholder:text-slate-400 resize-none min-h-[44px] max-h-[200px]"
                                rows={Math.min(5, input.split('\n').length || 1)}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-300 text-white flex items-center justify-center transition-all flex-shrink-0"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                        <p className="text-center mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responses are generated by AI and may require human verification</p>
                    </div>
                </div>
                <style dangerouslySetInnerHTML={{__html: `
                    @keyframes fade-in-up {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}} />
                {/* Handbook Modal Overlay */}
                {showHandbook && (
                    <div className="absolute inset-4 z-50 bg-white/95 backdrop-blur-xl border border-slate-200/60 shadow-2xl rounded-3xl p-8 animate-[fade-in-up_0.2s_ease-out_both] flex flex-col m-auto max-w-4xl max-h-[90vh]">
                        <div className="flex items-center justify-between mb-6 border-b border-slate-200/60 pb-5">
                            <div>
                                <h3 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
                                    <Library className="w-6 h-6 text-indigo-600" />
                                    AI Prompt Handbook
                                </h3>
                                <p className="text-sm text-slate-500 mt-1 font-medium">Templates styled for reflexive thematic analysis.</p>
                            </div>
                            <button onClick={() => setShowHandbook(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-xl transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 pb-12">
                            {/* Structural Rule Info */}
                            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-8">
                                <h4 className="text-sm font-extrabold text-indigo-900 mb-2 uppercase tracking-wide">The "5 Rules" of a Perfect Prompt</h4>
                                <ul className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                    {[
                                        { title: "1. Role", desc: "Act as a..." },
                                        { title: "2. Context", desc: "Review my data..." },
                                        { title: "3. Task", desc: "Identify themes..." },
                                        { title: "4. Format", desc: "Write a bulleted list..." },
                                        { title: "5. Evidence", desc: "Extract quotes..." }
                                    ].map(rule => (
                                        <li key={rule.title} className="bg-white/80 p-3 rounded-xl border border-indigo-50">
                                            <div className="text-[12px] font-bold text-indigo-700">{rule.title}</div>
                                            <div className="text-[11px] text-slate-600">{rule.desc}</div>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Phases */}
                            <div className="space-y-8">
                                {promptCategories.map((category, i) => (
                                    <div key={i}>
                                        {category.isHero ? (
                                            /* Hero: Full Pipeline card */
                                            <div className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 p-6 mb-2 shadow-lg">
                                                <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
                                                <div className="absolute bottom-0 left-0 w-32 h-20 bg-indigo-800/20 rounded-full blur-2xl pointer-events-none" />
                                                <div className="relative flex flex-col gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[10px] font-extrabold text-indigo-200 uppercase tracking-widest">Recommended for advanced use</span>
                                                        </div>
                                                        <h4 className="text-xl font-extrabold text-white">{category.phase}</h4>
                                                        <p className="text-indigo-200 text-[13px] mt-1 font-medium leading-relaxed">
                                                            Runs all 6 phases of Braun & Clarke's RTA in a single prompt — from familiarization to a full narrative report. Attach your transcript and send.
                                                        </p>
                                                    </div>
                                                    {category.prompts.map((suggestion, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                setInput(suggestion.prompt)
                                                                setShowHandbook(false)
                                                                inputRef.current?.focus()
                                                            }}
                                                            className="bg-white hover:bg-indigo-50 text-indigo-700 font-bold text-sm px-5 py-3 rounded-xl transition-all w-full text-center flex items-center justify-center gap-2 shadow-sm"
                                                        >
                                                            <Sparkles className="w-4 h-4" />
                                                            Use this template: {suggestion.title}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            /* Regular phase */
                                            <>
                                                <div className="flex items-center gap-3 mb-4">
                                                    <span className="bg-slate-800 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md">{category.phase.split(':')[0]}</span>
                                                    <h4 className="text-base font-extrabold text-slate-800">{category.phase.split(':')[1]}</h4>
                                                </div>
                                                <div className="grid grid-cols-1 gap-3">
                                                    {category.prompts.map((suggestion, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                setInput(suggestion.prompt)
                                                                setShowHandbook(false)
                                                                inputRef.current?.focus()
                                                            }}
                                                            className="bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-md hover:ring-2 hover:ring-indigo-100 p-5 rounded-2xl transition-all group flex flex-col gap-2 items-start text-left relative overflow-hidden"
                                                        >
                                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                                <Sparkles className="w-5 h-5 text-indigo-500" />
                                                            </div>
                                                            <span className="text-[14px] font-bold text-slate-800 group-hover:text-indigo-700 transition-colors pr-10">{suggestion.title}</span>
                                                            <span className="text-[13px] font-medium text-slate-500 leading-relaxed pr-8 line-clamp-3">
                                                                {suggestion.prompt.split('. ').map((sentence, sIdx) => {
                                                                    const isRule = sentence.startsWith('Act as') || sentence.startsWith('Role') || sentence.includes('Format') || sentence.includes('evidence');
                                                                    return <span key={sIdx} className={isRule ? 'text-indigo-600 font-semibold' : ''}>{sentence}. </span>
                                                                })}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
