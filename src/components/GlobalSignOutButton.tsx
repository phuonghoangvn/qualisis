'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

export default function GlobalSignOutButton() {
    return (
        <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all rounded-lg border border-transparent hover:border-rose-100"
        >
            <LogOut className="w-4 h-4" /> Sign Out
        </button>
    )
}
