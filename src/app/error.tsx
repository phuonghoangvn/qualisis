'use client';
export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Application Error Caught!</h1>
      <p style={{ color: 'red' }}>{error.message || String(error)}</p>
      <pre style={{ overflow: 'auto', background: '#f5f5f5', padding: '1rem' }}>{error.stack}</pre>
    </div>
  );
}
