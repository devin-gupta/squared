'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LineItem } from '@/types/transaction'

interface ReceiptLineItemEditorProps {
  lineItems: LineItem[]
  members: { id: string; name: string }[]
  totalAmount: number
  onChange: (lineItems: LineItem[]) => void
}

export default function ReceiptLineItemEditor({
  lineItems,
  members,
  totalAmount,
  onChange,
}: ReceiptLineItemEditorProps) {
  const [editedItems, setEditedItems] = useState<LineItem[]>(lineItems)

  useEffect(() => {
    setEditedItems(lineItems)
  }, [lineItems])

  const handleItemChange = (index: number, updates: Partial<LineItem>) => {
    const updated = [...editedItems]
    updated[index] = { ...updated[index], ...updates }
    setEditedItems(updated)
    onChange(updated)
  }

  const handleMemberToggle = (itemIndex: number, memberId: string) => {
    const item = editedItems[itemIndex]
    const currentSplit = item.split_among || []
    // Handle both IDs and names - check if memberId or member name matches
    const member = members.find((m) => m.id === memberId)
    const memberName = member?.name
    
    const isIncluded = currentSplit.some(
      (idOrName) => idOrName === memberId || idOrName === memberName
    )
    
    const newSplit = isIncluded
      ? currentSplit.filter((idOrName) => idOrName !== memberId && idOrName !== memberName)
      : [...currentSplit.filter((idOrName) => {
          // Remove any old names/IDs for this member
          const existingMember = members.find((m) => m.id === idOrName || m.name === idOrName)
          return !existingMember || existingMember.id !== memberId
        }), memberId]

    handleItemChange(itemIndex, { split_among: newSplit })
  }

  const handleRemoveItem = (index: number) => {
    const updated = editedItems.filter((_, i) => i !== index)
    setEditedItems(updated)
    onChange(updated)
  }

  const handleAddItem = () => {
    const newItem: LineItem = {
      description: '',
      amount: 0,
      category: 'food',
      split_among: [],
    }
    const updated = [...editedItems, newItem]
    setEditedItems(updated)
    onChange(updated)
  }

  const calculateAllocatedTotal = () => {
    return editedItems.reduce((sum, item) => sum + item.amount, 0)
  }

  const allocatedTotal = calculateAllocatedTotal()
  const difference = totalAmount - allocatedTotal

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-serif font-bold text-accent">Line Items</h3>
        <button
          type="button"
          onClick={handleAddItem}
          className="text-sm text-accent/60 hover:text-accent border border-accent/20 px-3 py-1 rounded-full"
        >
          + Add Item
        </button>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {editedItems.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-accent/5 border border-accent/10 rounded-lg"
          >
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-accent/70 mb-1">Description</label>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => handleItemChange(index, { description: e.target.value })}
                  className="w-full px-3 py-2 bg-transparent border-b border-accent/20 text-accent text-sm focus:outline-none focus:border-accent"
                  placeholder="Item name"
                />
              </div>
              <div>
                <label className="block text-xs text-accent/70 mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={item.amount}
                  onChange={(e) =>
                    handleItemChange(index, { amount: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-transparent border-b border-accent/20 text-accent text-sm focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-xs text-accent/70 mb-1">Category</label>
              <select
                value={item.category}
                onChange={(e) => handleItemChange(index, { category: e.target.value })}
                className="w-full px-3 py-2 bg-transparent border-b border-accent/20 text-accent text-sm focus:outline-none focus:border-accent"
              >
                <option value="food">Food</option>
                <option value="alcohol">Alcohol</option>
                <option value="groceries">Groceries</option>
                <option value="gas">Gas</option>
                <option value="lodging">Lodging</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="mb-2">
              <label className="block text-xs text-accent/70 mb-2">
                Split Among (leave empty to split among all)
              </label>
              <div className="flex flex-wrap gap-2">
                {members.map((member) => {
                  // Check if member is selected (by ID or name)
                  const isSelected = item.split_among?.some(
                    (idOrName) => idOrName === member.id || idOrName === member.name
                  )
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleMemberToggle(index, member.id)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        isSelected
                          ? 'bg-accent text-base border-accent'
                          : 'bg-transparent text-accent/60 border-accent/20 hover:border-accent/40'
                      }`}
                    >
                      {member.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleRemoveItem(index)}
              className="text-xs text-red-600 hover:text-red-700 mt-2"
            >
              Remove
            </button>
          </motion.div>
        ))}
      </div>

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
