'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface CustomSplitEditorProps {
  members: { id: string; name: string }[]
  totalAmount: number
  tripId: string | null
  existingAdjustments?: { memberId: string; amount: number }[]
  onChange: (adjustments: { memberId: string; amount: number }[]) => void
}

type EditorMode = 'manual' | 'llm'

export default function CustomSplitEditor({
  members,
  totalAmount,
  tripId,
  existingAdjustments = [],
  onChange,
}: CustomSplitEditorProps) {
  const [mode, setMode] = useState<EditorMode>('manual')
  const [adjustments, setAdjustments] = useState<{ memberId: string; amount: number }[]>([])
  const [llmInput, setLlmInput] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  useEffect(() => {
    if (existingAdjustments.length > 0) {
      setAdjustments(existingAdjustments)
    } else {
      // Initialize with all members at 0
      setAdjustments(
        members.map((m) => ({
          memberId: m.id,
          amount: 0,
        }))
      )
    }
  }, [members, existingAdjustments])

  const handleAmountChange = (memberId: string, amount: string) => {
    const numAmount = parseFloat(amount) || 0
    const updated = adjustments.map((adj) =>
      adj.memberId === memberId ? { ...adj, amount: numAmount } : adj
    )
    setAdjustments(updated)
    onChange(updated)
  }

  const handleParseLlm = async () => {
    if (!llmInput.trim()) return

    setIsParsing(true)
    setParseError(null)

    try {
      const response = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: llmInput, tripId }),
      })

      if (!response.ok) {
        throw new Error('Failed to parse input')
      }

      const { parsed } = await response.json()

      if (parsed.adjustments && parsed.adjustments.length > 0) {
        const memberMap = new Map(members.map((m) => [m.name.toLowerCase(), m.id]))

        const parsedAdjustments = parsed.adjustments
          .map((adj) => {
            const memberId = memberMap.get(adj.user_name.toLowerCase())
            if (!memberId) return null
            return { memberId, amount: adj.amount }
          })
          .filter((adj): adj is { memberId: string; amount: number } => adj !== null)

        // Fill in missing members with 0
        members.forEach((member) => {
          if (!parsedAdjustments.find((a) => a.memberId === member.id)) {
            parsedAdjustments.push({ memberId: member.id, amount: 0 })
          }
        })

        setAdjustments(parsedAdjustments)
        onChange(parsedAdjustments)
      } else {
        // If no adjustments, assume equal split and calculate
        const perPerson = totalAmount / members.length
        const equalAdjustments = members.map((m) => ({
          memberId: m.id,
          amount: perPerson,
        }))
        setAdjustments(equalAdjustments)
        onChange(equalAdjustments)
      }
    } catch (error) {
      console.error('Error parsing LLM input:', error)
      setParseError(
        error instanceof Error
          ? error.message
          : 'Failed to parse input. Try a different format.'
      )
    } finally {
      setIsParsing(false)
    }
  }

  const calculateTotal = () => {
    return adjustments.reduce((sum, adj) => sum + adj.amount, 0)
  }

  const allocatedTotal = calculateTotal()
  const difference = totalAmount - allocatedTotal

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-serif font-bold text-accent">Custom Split</h3>
        <div className="flex gap-2 border border-accent/20 rounded-full p-1">
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              mode === 'manual'
                ? 'bg-accent text-base'
                : 'text-accent/60 hover:text-accent'
            }`}
          >
            Manual
          </button>
          <button
            type="button"
            onClick={() => setMode('llm')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              mode === 'llm' ? 'bg-accent text-base' : 'text-accent/60 hover:text-accent'
            }`}
          >
            Text Input
          </button>
        </div>
      </div>

      {mode === 'manual' ? (
        <div className="space-y-3">
          {members.map((member) => {
            const adjustment = adjustments.find((a) => a.memberId === member.id)
            const amount = adjustment?.amount || 0

            return (
              <div key={member.id} className="flex items-center justify-between">
                <label className="text-sm text-accent/70 font-medium">{member.name}</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-accent/40">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => handleAmountChange(member.id, e.target.value)}
                    className="w-24 px-3 py-2 bg-transparent border-b border-accent/20 text-accent text-sm text-right focus:outline-none focus:border-accent"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-accent/70 mb-2">
              Enter split instructions (e.g., "Alice pays $20, Bob pays $15, rest split equally")
            </label>
            <textarea
              value={llmInput}
              onChange={(e) => setLlmInput(e.target.value)}
              className="w-full px-4 py-3 bg-transparent border-2 border-accent/20 rounded-lg text-accent text-sm focus:outline-none focus:border-accent min-h-[100px]"
              placeholder="Alice pays $20, Bob pays $15, rest split equally"
            />
            {parseError && (
              <div className="mt-2 text-xs text-red-600">{parseError}</div>
            )}
          </div>
          <button
            type="button"
            onClick={handleParseLlm}
            disabled={isParsing || !llmInput.trim()}
            className="w-full py-2 bg-accent text-base rounded-full font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isParsing ? 'Parsing...' : 'Parse & Apply'}
          </button>
          {adjustments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="pt-3 border-t border-accent/10 space-y-2"
            >
              <div className="text-xs text-accent/60 mb-2">Parsed amounts:</div>
              {members.map((member) => {
                const adjustment = adjustments.find((a) => a.memberId === member.id)
                const amount = adjustment?.amount || 0
                return (
                  <div key={member.id} className="flex justify-between text-sm">
                    <span className="text-accent/70">{member.name}:</span>
                    <span className="text-accent">${amount.toFixed(2)}</span>
                  </div>
                )
              })}
            </motion.div>
          )}
        </div>
      )}

      <div className="pt-4 border-t border-accent/10">
        <div className="flex justify-between items-center text-sm">
          <span className="text-accent/70">Allocated Total:</span>
          <span className="font-medium text-accent">${allocatedTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-sm mt-1">
          <span className="text-accent/70">Transaction Total:</span>
          <span className="font-medium text-accent">${totalAmount.toFixed(2)}</span>
        </div>
        {Math.abs(difference) > 0.01 && (
          <div
            className={`flex justify-between items-center text-sm mt-1 ${
              difference > 0 ? 'text-yellow-600' : 'text-red-600'
            }`}
          >
            <span>Difference:</span>
            <span className="font-medium">
              {difference > 0 ? '+' : ''}${difference.toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
