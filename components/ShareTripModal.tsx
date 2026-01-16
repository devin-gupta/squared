'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { generateShareUrl, shareTrip, copyToClipboard } from '@/lib/trips/share'

interface ShareTripModalProps {
  isOpen: boolean
  onClose: () => void
  inviteCode: string
  tripName: string
}

export default function ShareTripModal({
  isOpen,
  onClose,
  inviteCode,
  tripName,
}: ShareTripModalProps) {
  const [copied, setCopied] = useState(false)
  const shareUrl = generateShareUrl(inviteCode)

  const handleNativeShare = async () => {
    const shared = await shareTrip(inviteCode, tripName)
    if (shared) {
      onClose()
    }
  }

  const handleCopyLink = async () => {
    const success = await copyToClipboard(shareUrl)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const hasNativeShare = typeof navigator !== 'undefined' && navigator.share

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
              <h2 className="text-2xl font-serif font-bold text-accent mb-2">Share Trip</h2>
              <p className="text-sm text-accent/60 mb-6">{tripName}</p>

              <div className="space-y-4">
                {/* Invite Code */}
                <div>
                  <label className="block text-sm font-medium text-accent/70 mb-2">
                    Invite Code
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inviteCode}
                      readOnly
                      className="flex-1 px-4 py-3 bg-accent/5 border border-accent/20 rounded-lg text-accent font-mono text-lg text-center"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-3 bg-accent text-base rounded-lg font-medium"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center py-4">
                  <QRCodeSVG value={shareUrl} size={200} />
                  <p className="text-xs text-accent/60 mt-4 text-center">
                    Scan to join trip
                  </p>
                </div>

                {/* Share URL */}
                <div>
                  <label className="block text-sm font-medium text-accent/70 mb-2">
                    Share Link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 px-4 py-3 bg-accent/5 border border-accent/20 rounded-lg text-accent text-sm"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-3 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors"
                    >
                      {copied ? '✓' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Native Share Button (if available) */}
                {hasNativeShare && (
                  <button
                    onClick={handleNativeShare}
                    className="w-full py-3 bg-accent text-base rounded-lg font-medium"
                  >
                    Share via...
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="w-full py-3 border border-accent/20 text-accent rounded-lg hover:bg-accent/5 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
