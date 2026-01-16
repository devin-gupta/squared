'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface CameraButtonProps {
  onImageCapture: (file: File) => void
  disabled?: boolean
}

export default function CameraButton({ onImageCapture, disabled }: CameraButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      
      onImageCapture(file)
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <motion.button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent hover:bg-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        whileTap={{ scale: 0.95 }}
        aria-label="Take photo of receipt"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0v3.75m0-3.75h3.75m-3.75 0h-3.75"
          />
        </svg>
      </motion.button>
      {preview && (
        <div className="mt-4">
          <img src={preview} alt="Receipt preview" className="max-w-full h-32 object-contain rounded" />
        </div>
      )}
    </>
  )
}
