'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import ConfirmModal from './ConfirmModal'

export default function DeleteProjectButton({ 
    projectId, 
    projectName 
}: { 
    projectId: string
    projectName: string 
}) {
    const [isDeleting, setIsDeleting] = useState(false)
    const router = useRouter()

    const [showConfirm, setShowConfirm] = useState(false)

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault() // Prevent traversing Link component
        e.stopPropagation() // Prevent bubbling
        setShowConfirm(true)
    }

    const confirmDelete = async () => {
        setShowConfirm(false)
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
            if (res.ok) {
                router.refresh()
            } else {
                console.error('Failed to delete project')
            }
        } catch (error) {
            console.error('Delete error', error)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <>
            <button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className={`absolute top-4 right-4 p-2 bg-white rounded-lg shadow-sm border text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all z-10 
                ${isDeleting ? 'opacity-50 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100 border-slate-200'}`}
                title="Delete project"
            >
                <Trash2 className="w-4 h-4" />
            </button>
            <ConfirmModal
                isOpen={showConfirm}
                title="Delete Project"
                message={`Are you sure you want to delete "${projectName}"?\n\nThis action cannot be undone and will delete all associated datasets, transcripts, and analysis.`}
                isDestructive={true}
                confirmText="Delete Project"
                onConfirm={confirmDelete}
                onCancel={() => setShowConfirm(false)}
            />
        </>
    )
}
