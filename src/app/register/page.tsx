'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Network, CheckCircle2 } from 'lucide-react'

export default function RegisterPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [isPending, setIsPending] = useState(false)

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Registration failed')
                setIsLoading(false)
            } else if (data.pending) {
                // Account created but awaiting approval
                setIsPending(true)
                setIsLoading(false)
            }
        } catch (e: any) {
            setError('An unexpected error occurred. Please try again.')
            setIsLoading(false)
        }
    }

    if (isPending) {
        return (
            <div className="min-h-screen bg-slate-50 flex">
                <div className="hidden lg:flex w-1/2 bg-indigo-600 flex-col justify-center px-20 relative overflow-hidden">
                    {/* Retaining the left column design */}
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKSIvPjwvc3ZnPg==')] opacity-50"></div>
                    <div className="relative z-10 text-white">
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-8 backdrop-blur-sm border border-white/20 shadow-xl">
                            <Network className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight">
                            Traceable AI <br/><span className="text-indigo-200">Qualitative Analysis</span>
                        </h1>
                    </div>
                </div>

                <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 lg:p-24 bg-white relative">
                    <div className="w-full max-w-md">
                        <div className="bg-white py-10 px-8 rounded-3xl border border-slate-200 text-center shadow-2xl shadow-indigo-100/50">
                            <div className="w-20 h-20 rounded-2xl bg-amber-50 border-2 border-amber-100 flex items-center justify-center mx-auto mb-6">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12 19.79 19.79 0 0 1 1.93 3.26 2 2 0 0 1 3.91 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                                </svg>
                            </div>
                            <h2 className="text-2xl font-extrabold text-slate-900 mb-3 tracking-tight">Account Pending Approval</h2>
                            <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">
                                Your account has been created successfully. Access to QualiSIS is by invitation only and requires admin approval.
                            </p>
                            <a
                                href={`mailto:hoangnnp01@gmail.com?subject=QualiSIS Access Request&body=Hi, I just registered an account and would like to request access. My name is ${name} and my email is ${email}.`}
                                className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-all hover:scale-105 shadow-xl shadow-indigo-600/20 w-full"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                                Contact hoangnnp01@gmail.com
                            </a>
                            <p className="mt-6 text-xs text-slate-400 font-medium">
                                Once approved, you can <Link href="/login" className="text-indigo-600 font-bold hover:underline">sign in here</Link>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Left Column: Branding & Info */}
            <div className="hidden lg:flex w-1/2 bg-indigo-600 flex-col justify-center px-20 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKSIvPjwvc3ZnPg==')] opacity-50"></div>
                
                <div className="relative z-10 text-white">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-8 backdrop-blur-sm border border-white/20 shadow-xl">
                        <Network className="w-8 h-8 text-white" />
                    </div>
                    
                    <h1 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight">
                        Traceable AI <br/><span className="text-indigo-200">Qualitative Analysis</span>
                    </h1>
                    
                    <p className="text-lg text-indigo-100 mb-10 leading-relaxed font-medium bg-black/10 p-5 rounded-2xl border border-white/10">
                        A structured academic workstation designed to bring rigorous, transparent, and reproducible AI assistance to your qualitative research workflows.
                    </p>
                    
                    <div className="space-y-4">
                        {[
                            'Reflexive Thematic Analysis (RTA) workflow builder',
                            'Traceable AI logic with algorithmic reliability reports',
                            'Cross-referenced Codebooks & Thematic Knowledge Graphs',
                            'Immersive presentation mode for data storytelling'
                        ].map((feature, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                                <span className="text-sm font-semibold tracking-wide text-indigo-50">{feature}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Column: Register Form */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 lg:p-24 relative bg-white">
                <div className="w-full max-w-md">
                    <div className="mb-8 text-center lg:text-left">
                        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create Account</h2>
                        <p className="mt-2 text-sm text-slate-500 font-medium">
                           Already have an account?{' '}
                            <Link href="/login" className="font-bold text-indigo-600 hover:text-indigo-500 hover:underline transition-all">
                                Sign in instead
                            </Link>
                        </p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                                {error}
                            </div>
                        )}

                        <div className="group">
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Full Name</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium transition-all group-hover:border-slate-300"
                                placeholder="Sarah Doe"
                            />
                        </div>

                        <div className="group">
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Email address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium transition-all group-hover:border-slate-300"
                                placeholder="researcher@university.edu"
                            />
                        </div>

                        <div className="group">
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium transition-all group-hover:border-slate-300"
                                placeholder="••••••••"
                                minLength={6}
                            />
                            <p className="mt-1.5 text-[11px] font-medium text-slate-400">Must be at least 6 characters long.</p>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-600/30 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all hover:scale-[1.02] ${isLoading ? 'opacity-70 cursor-not-allowed scale-100' : ''}`}
                            >
                                {isLoading ? 'Creating account...' : 'Create Account'}
                            </button>
                        </div>
                        
                        <p className="text-center text-[11px] font-medium text-slate-400 leading-relaxed max-w-xs mx-auto mt-6">
                            Access to QualiSIS is by invitation only. After registration, contact hoangnnp01@gmail.com to request access.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    )
}
