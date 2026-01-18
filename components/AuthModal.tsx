'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'

interface AuthModalProps {
  isOpen: boolean
  onClose?: () => void
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setIsSuccess(false)

    try {
      await signIn(email.trim())
      setIsSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link')
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
              <h2 className="text-2xl font-serif font-bold text-accent mb-6">Sign In</h2>

              {isSuccess ? (
                <div className="space-y-4">
                  <div className="text-accent/70">
                    <p className="mb-2">Check your email!</p>
                    <p className="text-sm">
                      We've sent you a magic link. Click the link in your email to sign in.
                    </p>
                  </div>
                  {onClose && (
                    <button
                      onClick={onClose}
                      className="w-full py-3 bg-accent text-base rounded-full font-medium"
                    >
                      Got it
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-accent/70 mb-2">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-4 py-3 bg-transparent border-b-2 border-accent/20 text-accent text-lg focus:outline-none focus:border-accent transition-colors"
                      required
                      autoFocus
                    />
                  </div>

                  {error && (
                    <div className="text-sm text-red-600">{error}</div>
                  )}

                  <div className="flex gap-4 pt-4">
                    {onClose && (
                      <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 border border-accent/20 text-accent rounded-full hover:bg-accent/5 transition-colors"
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={!email.trim() || isSubmitting}
                      className="flex-1 py-3 bg-accent text-base rounded-full font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Sending...' : 'Send Magic Link'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
