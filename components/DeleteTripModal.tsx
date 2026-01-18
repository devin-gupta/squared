'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface DeleteTripModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  tripName: string
  isDeleting?: boolean
}

export default function DeleteTripModal({
  isOpen,
  onClose,
  onConfirm,
  tripName,
  isDeleting = false,
}: DeleteTripModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-accent/20 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-base rounded-2xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-serif font-bold text-accent mb-4">Delete Trip</h2>

              <div className="mb-6">
                <p className="text-accent/70 mb-2">
                  Are you sure you want to delete <strong>{tripName}</strong>?
                </p>
                <p className="text-sm text-red-600">
                  This will permanently delete the trip and all its transactions. This action cannot be undone.
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 border border-accent/20 text-accent rounded-full hover:bg-accent/5 transition-colors"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-red-600 text-white rounded-full font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Trip'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
