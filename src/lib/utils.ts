import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getTranscriptIdentity(name: string) {
    if (!name) return { initials: 'U', color: 'bg-slate-500', text: 'text-white' };
    const clean = name.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Unknown';
    const words = clean.split(/\s+/);
    const initials = words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : clean.substring(0, 2).toUpperCase();
    
    const colors = [
        { bg: 'bg-indigo-500', text: 'text-white' },
        { bg: 'bg-rose-500', text: 'text-white' },
        { bg: 'bg-emerald-500', text: 'text-white' },
        { bg: 'bg-amber-500', text: 'text-white' },
        { bg: 'bg-cyan-500', text: 'text-white' },
        { bg: 'bg-violet-500', text: 'text-white' },
        { bg: 'bg-pink-500', text: 'text-white' },
        { bg: 'bg-orange-500', text: 'text-white' },
    ];
    let hash = 0;
    for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    const idx = Math.abs(hash) % colors.length;
    
    return { initials, color: colors[idx].bg, text: colors[idx].text };
}
