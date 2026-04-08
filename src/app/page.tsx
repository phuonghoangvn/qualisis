import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export default async function LandingPage() {
    const session = await getServerSession(authOptions)
    
    // If logged in, go straight to projects
    if (session) {
        redirect('/projects')
    }

    // If not logged in, the first screen they see is the dual-purpose auth/info screen (login)
    redirect('/login')
}
