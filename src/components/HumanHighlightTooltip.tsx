'use client'

import { useEffect, useRef, useState } from 'react'

export default function HumanHighlightTooltip({
    transcriptId,
    onCodeApplied,
}: {
    transcriptId: string
    onCodeApplied: () => void
}) {
    const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)
    const [selection, setSelection] = useState<{ text: string; range: Range } | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [codeName, setCodeName] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

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
            setTooltip({ x: rect.left + window.scrollX, y: rect.bottom + window.scrollY + 6 })
            setSelection({ text, range: range.cloneRange() })
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
        setTimeout(() => inputRef.current?.focus(), 50)
    }

    function applyCode() {
        if (!codeName.trim() || !selection) return
        try {
            const span = document.createElement('span')
            span.className = 'h-human'
            span.title = `Human Code: ${codeName}`
            selection.range.surroundContents(span)
        } catch {
            // Selection crosses element boundaries — ignore
        }
        window.getSelection()?.removeAllRanges()
        setShowModal(false)
        setSelection(null)
        onCodeApplied()
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
                            placeholder="e.g. Emotional Exhaustion"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
