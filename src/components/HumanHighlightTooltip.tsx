'use client'

import { useEffect, useRef, useState } from 'react'

export default function HumanHighlightTooltip({
    transcriptId,
    projectId,
    transcriptContent,
    onCodeApplied,
}: {
    transcriptId: string
    projectId: string
    transcriptContent: string
    onCodeApplied: () => void
}) {
    const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)
    const [selection, setSelection] = useState<{ text: string; range: Range; startIndex?: number; endIndex?: number } | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [codeName, setCodeName] = useState('')
    const [codeDescription, setCodeDescription] = useState('')
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (showModal && selection?.text) {
            setAiSuggestions([])
            setIsLoadingSuggestions(true)
            
            fetch('/api/suggest-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: selection.text,
                    transcriptContent,
                    projectId
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.suggestions) {
                    setAiSuggestions(data.suggestions)
                }
            })
            .catch(console.error)
            .finally(() => setIsLoadingSuggestions(false))
        }
    }, [showModal, selection, projectId])

    useEffect(() => {
        const handleMouseUp = (e: MouseEvent) => {
            const sel = window.getSelection()
            if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
                setTooltip(null)
                return
            }
            const range = sel.getRangeAt(0)
            const text = sel.toString().trim()
            if (!text) return

            const rect = range.getBoundingClientRect()
            
            // Reconstruct absolute offsets from DOM data-offset tags
            const getAbsoluteOffset = (node: Node | null, relativeOffset: number) => {
                if (!node) return null;
                let el: HTMLElement | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
                while (el && !el.hasAttribute('data-offset')) {
                    el = el.parentElement;
                }
                if (el && el.hasAttribute('data-offset')) {
                    const baseOffset = parseInt(el.getAttribute('data-offset') || '0', 10);
                    return baseOffset + relativeOffset;
                }
                return null;
            };

            let startIndex = getAbsoluteOffset(range.startContainer, range.startOffset);
            let endIndex = getAbsoluteOffset(range.endContainer, range.endOffset);

            // Sanitize in case range logic is flipped
            if (startIndex !== null && endIndex !== null && startIndex > endIndex) {
                const tmp = startIndex;
                startIndex = endIndex;
                endIndex = tmp;
            }

            setTooltip({ x: rect.left + window.scrollX, y: rect.bottom + window.scrollY + 6 })
            setSelection({ text, range: range.cloneRange(), startIndex: startIndex ?? undefined, endIndex: endIndex ?? undefined })
        }

        const handleMouseDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (!target.closest('[data-tooltip]')) {
                setTooltip(null)
            }
        }

        document.addEventListener('mouseup', handleMouseUp)
        document.addEventListener('mousedown', handleMouseDown)
        return () => {
            document.removeEventListener('mouseup', handleMouseUp)
            document.removeEventListener('mousedown', handleMouseDown)
        }
    }, [])

    function openModal() {
        setTooltip(null)
        setShowModal(true)
        setCodeName('')
        setCodeDescription('')
        setTimeout(() => inputRef.current?.focus(), 50)
    }

    async function applyCode() {
        if (!codeName.trim() || !selection) return
        
        let startIndex = selection.startIndex ?? transcriptContent.indexOf(selection.text)
        if (startIndex === -1) startIndex = 0
        const endIndex = selection.endIndex ?? (startIndex + selection.text.length)
        
        // Safety check to ensure we get exactly the text we're referring to for the DB, ignoring CSS selections
        let rawContent = transcriptContent.slice(startIndex, endIndex);
        if (!rawContent.trim()) rawContent = selection.text;

        try {
            // Save segment and codebook entry concurrently to backend
            await fetch(`/api/transcripts/${transcriptId}/human-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    text: rawContent.trim(),
                    codeName: codeName.trim(),
                    codeDescription: codeDescription.trim(),
                    startIndex,
                    endIndex
                })
            })
        } catch (error) {
            console.error('Failed to create human code:', error)
            alert('Failed to save human code. Please try again.')
        } finally {
            window.getSelection()?.removeAllRanges()
            setShowModal(false)
            setSelection(null)
            onCodeApplied()
        }
    }

    return (
        <>
            {/* Floating tooltip */}
            {tooltip && (
                <div
                    data-tooltip
                    style={{ position: 'fixed', left: tooltip.x, top: tooltip.y, zIndex: 9999 }}
                    className="bg-slate-900 text-white text-xs font-medium rounded-lg px-3 py-2 shadow-lg flex items-center gap-2"
                >
                    <span>✍ Code this</span>
                    <button
                        onClick={openModal}
                        className="bg-white text-slate-900 text-xs font-bold px-2 py-0.5 rounded hover:bg-slate-100 transition"
                    >
                        Assign Code
                    </button>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                    <div className="bg-white rounded-2xl shadow-xl w-96 p-6">
                        <h3 className="font-semibold text-slate-800 mb-1">Assign Human Code</h3>
                        {selection && (
                            <p className="text-xs italic text-slate-500 border-l-2 border-purple-400 pl-2 mb-4 line-clamp-2">
                                "{selection.text}"
                            </p>
                        )}
                        <input
                            ref={inputRef}
                            type="text"
                            value={codeName}
                            onChange={e => setCodeName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && applyCode()}
                            placeholder="Code Name (e.g. Emotional Exhaustion)"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-purple-500 font-bold text-slate-800"
                        />
                        
                        <div className="mb-4 min-h-[24px]">
                            {isLoadingSuggestions ? (
                                <div className="flex gap-2 items-center text-[10px] text-slate-400 font-medium">
                                    <svg className="w-3 h-3 animate-spin text-purple-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    AI is learning human style...
                                </div>
                            ) : aiSuggestions.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 items-center">
                                    <div className="flex items-center gap-1 group relative">
                                        <span className="text-[10px] uppercase font-bold text-purple-400 flex items-center tracking-wider">✨ AI Suggests</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-300 cursor-help hover:text-purple-500 transition-colors"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                        <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block w-56 p-2.5 bg-slate-800 text-slate-50 text-[10px] rounded-lg shadow-lg z-50 leading-relaxed font-medium border border-slate-700">
                                            These labels are dynamically tailored to match your project's ontology and your recent coding style.
                                            <div className="absolute -bottom-1 left-3 w-2 h-2 bg-slate-800 border-b border-r border-slate-700 transform rotate-45"></div>
                                        </div>
                                    </div>
                                    <span className="text-purple-300 font-bold mr-1">:</span>
                                    {aiSuggestions.map(s => (
                                        <button 
                                            key={s}
                                            onClick={() => setCodeName(s)}
                                            className="text-[10px] font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 hover:shadow-sm border border-purple-200 px-2.5 py-0.5 rounded-full cursor-pointer transition-all active:scale-95"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                        <textarea
                            value={codeDescription}
                            onChange={e => setCodeDescription(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) applyCode()
                            }}
                            placeholder="Optional description / definition for this code..."
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none h-20 text-slate-600"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={applyCode}
                                disabled={!codeName.trim()}
                                className="flex-1 bg-purple-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-40"
                            >
                                Apply Code
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
