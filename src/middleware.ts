import { withAuth } from 'next-auth/middleware'

export default withAuth({
    pages: {
        signIn: '/login', // Redirect here if not authenticated
    },
})

// Protect these routes
export const config = {
    matcher: [
        '/projects/:path*',
    ],
}
