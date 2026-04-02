'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Settings, LogOut, User } from 'lucide-react'

export function UserDropdown() {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                aria-label="User Profile Menu"
            >
                <span className="text-slate-600 font-bold text-sm">Res</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 animate-[fade-in-up_0.15s_ease-out_both] origin-top-right">
                    <div className="px-4 py-2.5 border-b border-slate-100 mb-1">
                        <p className="text-sm font-bold text-slate-800">Researcher</p>
                        <p className="text-[11px] font-medium text-slate-500">QualiSIS Lab</p>
                    </div>
                    
                    <Link 
                        href="/profile" 
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
                    >
                        <Settings className="w-4 h-4 text-slate-400" />
                        Profile & Settings
                    </Link>
                    
                    <button
                        onClick={async () => {
                            setIsOpen(false)
                            await signOut({ redirect: false })
                            window.location.href = '/login'
                        }}
                        className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors mt-1 border-t border-slate-100"
                    >
                        <LogOut className="w-4 h-4 text-slate-400" />
                        Sign Out
                    </button>
                </div>
            )}
        </div>
    )
}
