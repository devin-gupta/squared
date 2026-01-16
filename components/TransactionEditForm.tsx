'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Transaction, LineItem } from '@/types/transaction'
import ReceiptLineItemEditor from './ReceiptLineItemEditor'
import CustomSplitEditor from './CustomSplitEditor'

interface TransactionEditFormProps {
  transaction: Transaction & {
    payer?: { display_name: string }
    adjustments?: Array<{
      member_id: string
      amount: number | string
      member?: { id: string; display_name: string }
    }>
  }
  memberNames: { id: string; name: string }[]
  tripId: string | null
  onSubmit: (data: Partial<Transaction> & { lineItems?: LineItem[]; adjustments?: Array<{ memberId: string; amount: number }> }) => void
  onCancel: () => void
}

export default function TransactionEditForm({
  transaction,
  memberNames,
  tripId,
  onSubmit,
  onCancel,
}: TransactionEditFormProps) {
  const [description, setDescription] = useState(transaction.description)
  const [totalAmount, setTotalAmount] = useState(transaction.total_amount.toString())
  const [payerId, setPayerId] = useState(transaction.payer_id)
  const [splitType, setSplitType] = useState<'equal' | 'custom'>(transaction.split_type)
  const [lineItems, setLineItems] = useState<LineItem[]>(transaction.line_items || [])
  const [adjustments, setAdjustments] = useState<Array<{ memberId: string; amount: number }>>([])

  const isReceipt = transaction.line_items && transaction.line_items.length > 0

  useEffect(() => {
    // Load adjustments from transaction
    if (transaction.adjustments && transaction.adjustments.length > 0) {
      const loadedAdjustments = transaction.adjustments.map((adj) => ({
        memberId: adj.member_id || adj.member?.id || '',
        amount: typeof adj.amount === 'string' ? parseFloat(adj.amount) : adj.amount,
      })).filter(adj => adj.memberId) // Filter out invalid entries
      setAdjustments(loadedAdjustments)
    }
  }, [transaction.adjustments])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const submitData: Partial<Transaction> & {
      lineItems?: LineItem[]
      adjustments?: Array<{ memberId: string; amount: number }>
    } = {
      description,
      total_amount: parseFloat(totalAmount) || 0,
      payer_id: payerId,
      split_type: splitType,
    }

    if (isReceipt) {
      submitData.lineItems = lineItems
    }

    if (splitType === 'custom') {
      submitData.adjustments = adjustments
    }

    onSubmit(submitData)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 bg-base z-50 p-6 overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
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

        {!isReceipt && (
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
        )}

        {isReceipt ? (
          <ReceiptLineItemEditor
            lineItems={lineItems}
            members={memberNames}
            totalAmount={parseFloat(totalAmount) || 0}
            onChange={setLineItems}
          />
        ) : splitType === 'custom' ? (
          <CustomSplitEditor
            members={memberNames}
            totalAmount={parseFloat(totalAmount) || 0}
            tripId={tripId}
            existingAdjustments={adjustments}
            onChange={setAdjustments}
          />
        ) : null}

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
