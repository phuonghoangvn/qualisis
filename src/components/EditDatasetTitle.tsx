'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Edit2, Check, X } from 'lucide-react';

export default function EditDatasetTitle({ datasetId, initialName }: { datasetId: string, initialName: string }) {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(initialName);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = async () => {
        if (!name.trim() || name === initialName) {
            setIsEditing(false);
            setName(initialName);
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`/api/datasets/${datasetId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });

            if (!res.ok) throw new Error('Failed to update dataset name');

            setIsEditing(false);
            router.refresh();
        } catch (error) {
            console.error('Update dataset error:', error);
            alert('Failed to update dataset name.');
            setName(initialName);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setName(initialName);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-2 flex-1 max-w-sm">
                <input
                    ref={inputRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    className="w-full px-3 py-1.5 text-sm font-bold border border-indigo-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
                <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                >
                    <Check className="w-4 h-4" />
                </button>
                <button
                    onClick={() => {
                        setName(initialName);
                        setIsEditing(false);
                    }}
                    disabled={isLoading}
                    className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
            <h2 className="text-sm font-bold text-slate-800">{initialName}</h2>
            <button className="p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-indigo-600 transition-all rounded">
                <Edit2 className="w-3 h-3" />
            </button>
        </div>
    );
}
