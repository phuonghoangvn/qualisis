import Link from 'next/link';

// Mock data fetch since we don't have the real DB running yet in the IDE
const datasets = [
    { id: '1', name: 'Round 1 Interviews', transcriptsCount: 5 },
    { id: '2', name: 'Field Notes', transcriptsCount: 2 },
];

export default function DatasetsPage() {
    return (
        <div className="flex-1 flex flex-col p-8 bg-muted/20">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Datasets</h1>
                <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium">
                    Upload Transcript
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {datasets.map((dataset) => (
                    <Link href={`/projects/demo/datasets/${dataset.id}`} key={dataset.id}>
                        <div className="bg-card border border-border p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                            <h3 className="font-semibold text-lg mb-2">{dataset.name}</h3>
                            <p className="text-muted-foreground text-sm">{dataset.transcriptsCount} transcripts</p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
