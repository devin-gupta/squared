'use client'

import { useState } from 'react'
import { TransactionParsed } from '@/types/transaction'

interface UseAIParserOptions {
  tripId: string | null
  onSuccess?: (parsed: TransactionParsed, receiptUrl?: string | null) => void
  onError?: (error: Error) => void
}

export function useAIParser({ tripId, onSuccess, onError }: UseAIParserOptions) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const parseText = async (text: string) => {
    if (!text.trim()) {
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, tripId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to parse transaction')
      }

      const { parsed } = await response.json()
      onSuccess?.(parsed)
      return parsed
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      onError?.(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const parseReceipt = async (file: File) => {
    setIsLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (tripId) {
        formData.append('tripId', tripId)
      }

      const response = await fetch('/api/ai/ocr', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to process receipt')
      }

      const { parsed, receiptUrl } = await response.json()
      onSuccess?.(parsed, receiptUrl)
      return { parsed, receiptUrl }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      onError?.(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return {
    parseText,
    parseReceipt,
    isLoading,
    error,
  }
}
