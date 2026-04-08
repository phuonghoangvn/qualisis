'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Network, CheckCircle2 } from 'lucide-react'

export default function LoginPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const res = await signIn('credentials', {
                email,
                password,
                redirect: false,
            })

            if (res?.error) {
                // Check if the account exists but is BANNED (awaiting approval)
                const checkRes = await fetch('/api/auth/check-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                })
                const checkData = await checkRes.json()
                if (checkData.banned) {
                    setError('BANNED')
                } else {
                    setError('Invalid email or password')
                }
            } else {
                router.push('/projects')
                router.refresh()
            }
        } catch (e: any) {
            setError('An unexpected error occurred. Please try again.')
        } finally {
            setIsLoading(false)
        }
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

            {/* Right Column: Auth Form */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 lg:p-24 relative bg-white">
                <div className="w-full max-w-md">
                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Login</h2>
                        <p className="mt-2 text-sm text-slate-500 font-medium">
                            Don't have an account?{' '}
                            <Link href="/register" className="font-bold text-indigo-600 hover:text-indigo-500 hover:underline transition-all">
                                Create a researcher account
                            </Link>
                        </p>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            error === 'BANNED' ? (
                                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm">
                                    <p className="font-bold text-amber-800 mb-1">Access Pending Approval</p>
                                    <p className="text-amber-700 leading-relaxed">
                                        Your account is awaiting admin approval. Please contact{' '}
                                        <a href="mailto:hoangnnp01@gmail.com" className="font-bold underline">hoangnnp01@gmail.com</a>
                                        {' '}to request access.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                                    {error}
                                </div>
                            )
                        )}

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
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-600/30 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all hover:scale-[1.02] ${isLoading ? 'opacity-70 cursor-not-allowed scale-100' : ''}`}
                            >
                                {isLoading ? 'Signing in securely...' : 'Sign in to Workspace'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
