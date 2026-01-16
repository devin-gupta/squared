'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type UndoType = 'transaction' | 'member'

interface UndoToastProps {
  show: boolean
  type: UndoType
  message: string
  onUndo: () => void
  onDismiss: () => void
  itemId: string
}

export default function UndoToast({
  show,
  type,
  message,
  onUndo,
  onDismiss,
  itemId,
}: UndoToastProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onDismiss()
      }, 5000) // 5 seconds

      return () => clearTimeout(timer)
    }
  }, [show, onDismiss])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
        >
          <div className="bg-accent text-base px-6 py-3 rounded-full shadow-lg flex items-center gap-4">
            <span className="text-sm">{message}</span>
            <button
              onClick={onUndo}
              className="text-sm font-medium underline"
            >
              Undo
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
