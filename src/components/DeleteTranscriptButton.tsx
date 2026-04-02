'use client';

import { useState } from 'react';
import ConfirmModal from './ConfirmModal';

export default function DeleteTranscriptButton({ transcriptId, transcriptTitle }: { transcriptId: string, transcriptTitle: string }) {
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
            const res = await fetch(`/api/transcripts/${transcriptId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                // Reload the current page to re-fetch the updated dataset list
                window.location.reload();
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || 'Failed to delete transcript');
                setIsDeleting(false);
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('An unexpected error occurred while deleting.');
            setIsDeleting(false);
        }
    };

    return (
        <>
        <button 
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className={`opacity-0 group-hover:opacity-100 transition-opacity ml-4 p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0 ${isDeleting ? 'opacity-100 cursor-not-allowed' : ''}`}
            title="Delete Transcript"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        </button>
        <ConfirmModal
            isOpen={showConfirm}
            title="Delete Transcript"
            message={`Are you sure you want to delete "${transcriptTitle}"?\n\nThis will permanently remove the transcript and all its highlights and code assignments.`}
            isDestructive={true}
            confirmText="Delete"
            onConfirm={confirmDelete}
            onCancel={() => setShowConfirm(false)}
        />
        </>
    );
}
