'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Transaction } from '@/types/transaction'

interface TransactionEditFormProps {
  transaction: Transaction & { payer?: { display_name: string } }
  memberNames: { id: string; name: string }[]
  onSubmit: (data: Partial<Transaction>) => void
  onCancel: () => void
}

export default function TransactionEditForm({
  transaction,
  memberNames,
  onSubmit,
  onCancel,
}: TransactionEditFormProps) {
  const [description, setDescription] = useState(transaction.description)
  const [totalAmount, setTotalAmount] = useState(transaction.total_amount.toString())
  const [payerId, setPayerId] = useState(transaction.payer_id)
  const [splitType, setSplitType] = useState<'equal' | 'custom'>(transaction.split_type)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    onSubmit({
      description,
      total_amount: parseFloat(totalAmount) || 0,
      payer_id: payerId,
      split_type: splitType,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 bg-base z-50 p-6 overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-6">
        <h2 className="text-2xl font-serif font-bold text-accent mb-6">Edit Transaction</h2>

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
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            className="w-full px-4 py-3 bg-transparent border-b-2 border-accent/20 text-accent focus:outline-none focus:border-accent"
          >
            {memberNames.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
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
