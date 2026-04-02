'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Edit2, Check, X } from 'lucide-react';

export default function EditTranscriptTitle({ transcriptId, initialTitle }: { transcriptId: string, initialTitle: string }) {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(initialTitle);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = async (e?: React.MouseEvent | React.FormEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        if (!title.trim() || title === initialTitle) {
            setIsEditing(false);
            setTitle(initialTitle);
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`/api/transcripts/${transcriptId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title.trim() })
            });

            if (!res.ok) throw new Error('Failed to update transcript title');

            setIsEditing(false);
            router.refresh();
        } catch (error) {
            console.error('Update transcript error:', error);
            alert('Failed to update transcript title.');
            setTitle(initialTitle);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setTitle(initialTitle);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-2 flex-1 max-w-sm ml-2" onClick={(e) => e.stopPropagation()}>
                <input
                    ref={inputRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    className="w-full px-2 py-1 text-sm font-semibold border border-indigo-200 bg-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
                <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors flex-shrink-0"
                >
                    <Check className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setTitle(initialTitle);
                        setIsEditing(false);
                    }}
                    disabled={isLoading}
                    className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors flex-shrink-0"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    }

    return (
        <div 
            className="flex items-center gap-2 group/edit cursor-pointer ml-3 flex-1"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsEditing(true);
            }}
        >
            <h3 className="text-sm font-semibold text-slate-700">{initialTitle}</h3>
            <button className="p-1 text-slate-300 opacity-0 group-hover/edit:opacity-100 hover:text-indigo-600 transition-all rounded">
                <Edit2 className="w-3 h-3" />
            </button>
        </div>
    );
}
