'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TransactionParsed } from '@/types/transaction'

interface ManualTransactionFormProps {
  initialData?: Partial<TransactionParsed>
  memberNames: string[]
  onSubmit: (data: TransactionParsed) => void
  onCancel: () => void
}

export default function ManualTransactionForm({
  initialData,
  memberNames,
  onSubmit,
  onCancel,
}: ManualTransactionFormProps) {
  const [description, setDescription] = useState(initialData?.description || '')
  const [totalAmount, setTotalAmount] = useState(initialData?.total_amount?.toString() || '')
  const [payerName, setPayerName] = useState(initialData?.payer_name || '')
  const [splitType, setSplitType] = useState<'equal' | 'custom'>(initialData?.split_type || 'equal')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const parsed: TransactionParsed = {
      description,
      total_amount: parseFloat(totalAmount) || 0,
      payer_name: payerName || undefined,
      split_type: splitType,
      adjustments: splitType === 'custom' ? initialData?.adjustments : undefined,
    }

    onSubmit(parsed)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 bg-base z-50 p-6 overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-6">
          <h2 className="text-2xl font-serif font-bold text-accent mb-6">Enter Transaction Details</h2>

        <div>
          <label className="block text-sm font-medium text-accent/70 mb-2">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-transparent border-b-2 border-accent/20 text-accent focus:outline-none focus:border-accent"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-accent/70 mb-2">
            Amount ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className="w-full px-4 py-3 bg-transparent border-b-2 border-accent/20 text-accent focus:outline-none focus:border-accent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-accent/70 mb-2">
            Paid By
          </label>
          <select
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            className="w-full px-4 py-3 bg-transparent border-b-2 border-accent/20 text-accent focus:outline-none focus:border-accent"
          >
            <option value="">Select payer</option>
            {memberNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-accent/70 mb-2">
            Split Type
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="equal"
                checked={splitType === 'equal'}
                onChange={() => setSplitType('equal')}
                className="mr-2"
              />
              Equal
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="custom"
                checked={splitType === 'custom'}
                onChange={() => setSplitType('custom')}
                className="mr-2"
              />
              Custom
            </label>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 border border-accent/20 text-accent rounded-full"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-3 bg-accent text-base rounded-full font-medium"
          >
            Save
          </button>
        </div>
      </form>
    </motion.div>
  )
}
