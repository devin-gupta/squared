'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import CameraButton from './CameraButton'

interface QuickAddProps {
  onSubmit: (text: string, imageFile?: File) => void
  isProcessing?: boolean
}

export default function QuickAdd({ onSubmit, isProcessing }: QuickAddProps) {
  const [input, setInput] = useState('')
  const [imageFile, setImageFile] = useState<File | undefined>()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() || imageFile) {
      onSubmit(input.trim(), imageFile)
      setInput('')
      setImageFile(undefined)
    }
  }

  const handleImageCapture = (file: File) => {
    setImageFile(file)
  }

  return (
    <div className="px-6 py-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Dinner $120, Jai didn't eat meat..."
            className="w-full min-h-[100px] p-4 text-lg bg-transparent border-none outline-none resize-none text-accent placeholder:text-accent/40 focus:ring-0"
            disabled={isProcessing}
          />
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-base/80 rounded-lg">
              <div className="w-6 h-6 border-2 border-success border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <CameraButton
            onImageCapture={handleImageCapture}
            disabled={isProcessing}
          />
          
          <motion.button
            type="submit"
            disabled={(!input.trim() && !imageFile) || isProcessing}
            className="px-6 py-3 bg-accent text-base rounded-full font-medium disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            whileHover={{ scale: 0.98, backgroundColor: 'rgba(45, 48, 46, 0.9)' }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            {isProcessing ? 'Processing...' : (
              <>
                <span>Add</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </>
            )}
          </motion.button>
        </div>

        {imageFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-accent/60 text-center"
          >
            Receipt captured: {imageFile.name}
          </motion.div>
        )}
      </form>
    </div>
  )
}
