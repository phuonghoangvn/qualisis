import Link from 'next/link';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* Left Panel: Navigation & Workflow */}
            <aside className="w-1/5 min-w-[250px] border-r border-border bg-card flex flex-col">
                <div className="p-4 border-b border-border">
                    <h2 className="font-semibold text-lg tracking-tight">Traceable AI</h2>
                    <p className="text-sm text-muted-foreground">Demo Project</p>
                </div>
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {[
                        { name: 'Dataset', href: '/projects/demo/datasets' },
                        { name: 'Codebook', href: '/projects/demo/codebook' },
                        { name: 'Themes', href: '/projects/demo/themes' },
                        { name: 'Report', href: '/projects/demo/report' },
                    ].map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors"
                        >
                            {item.name}
                        </Link>
                    ))}
                </nav>
                <div className="p-4 border-t border-border mt-auto">
                    <Link href="/audit" className="text-sm text-muted-foreground hover:text-foreground">
                        Audit Trail
                    </Link>
                </div>
            </aside>

            {/* Main Content Area (Center + Right panels rendered by children) */}
            <main className="flex-1 flex overflow-hidden">
                {children}
            </main>
        </div>
    );
}
