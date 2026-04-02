'use client';

import { useState } from 'react';
import ConfirmModal from './ConfirmModal';

export default function DeleteDatasetButton({ datasetId, datasetName }: { datasetId: string, datasetName: string }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowConfirm(true);
    };

    const confirmDelete = async () => {
        setShowConfirm(false);
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/datasets/${datasetId}`, { method: 'DELETE' });
            if (res.ok) {
                window.location.reload();
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || 'Failed to delete dataset');
                setIsDeleting(false);
            }
        } catch (error) {
            console.error('Delete dataset error:', error);
            alert('An unexpected error occurred while deleting.');
            setIsDeleting(false);
        }
    };

    return (
        <>
            <button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="ml-2 p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0 transition-colors"
                title="Delete Dataset"
            >
                {isDeleting ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                )}
            </button>
            <ConfirmModal
                isOpen={showConfirm}
                title="Delete Dataset"
                message={`Are you sure you want to delete "${datasetName}"?\n\nThis will permanently remove the dataset and all its transcripts, highlights, and code assignments.`}
                isDestructive={true}
                confirmText="Delete Dataset"
                onConfirm={confirmDelete}
                onCancel={() => setShowConfirm(false)}
            />
        </>
    );
}

