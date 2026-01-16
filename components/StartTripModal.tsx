'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface StartTripModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (tripName: string, userName: string) => Promise<void>
  defaultUserName?: string
}

export default function StartTripModal({
  isOpen,
  onClose,
  onSubmit,
  defaultUserName = '',
}: StartTripModalProps) {
  const [tripName, setTripName] = useState('')
  const [userName, setUserName] = useState(defaultUserName)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setUserName(defaultUserName)
      setTripName('')
    }
  }, [isOpen, defaultUserName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tripName.trim() || !userName.trim()) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(tripName.trim(), userName.trim())
      setTripName('')
    } catch (error) {
      console.error('Error creating trip:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

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
              <h2 className="text-2xl font-serif font-bold text-accent mb-6">Start New Trip</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="tripName" className="block text-sm font-medium text-accent/70 mb-2">
                    Trip Name
                  </label>
                  <input
                    id="tripName"
                    type="text"
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                    placeholder="Iceland '26"
                    className="w-full px-4 py-3 bg-transparent border-b-2 border-accent/20 text-accent text-lg focus:outline-none focus:border-accent transition-colors"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="userName" className="block text-sm font-medium text-accent/70 mb-2">
                    Your Name
                  </label>
                  <input
                    id="userName"
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 bg-transparent border-b-2 border-accent/20 text-accent text-lg focus:outline-none focus:border-accent transition-colors"
                    required
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 border border-accent/20 text-accent rounded-full hover:bg-accent/5 transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!tripName.trim() || !userName.trim() || isSubmitting}
                    className="flex-1 py-3 bg-accent text-base rounded-full font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Trip'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
