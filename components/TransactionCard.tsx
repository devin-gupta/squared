'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Transaction } from '@/types/transaction'

interface TransactionCardProps {
  transaction: Transaction & { payer?: { display_name: string } }
  onEdit?: () => void
  onDelete?: () => void
  canEdit?: boolean
}

export default function TransactionCard({
  transaction,
  onEdit,
  onDelete,
  canEdit = false,
}: TransactionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isRecent = new Date(transaction.created_at).getTime() > Date.now() - 5000

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'JUST NOW'
    if (diffMins < 60) return `${diffMins}M AGO`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}H AGO`
    return date.toLocaleDateString()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.15 }}
      className="px-4 py-3 bg-accent/5 border border-accent/10 rounded-lg mb-3 cursor-pointer"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-base font-serif font-light mb-1" style={{ color: 'rgb(45, 48, 46)' }}>
            {transaction.description}
          </div>
          <div className="text-xs uppercase tracking-wide text-accent/60 mb-1 font-sans">
            PAID BY {transaction.payer?.display_name?.toUpperCase() || 'UNKNOWN'}
          </div>
          <div className="text-xs text-accent/40 font-sans">
            {formatDate(transaction.created_at)}
          </div>
        </div>
        <div className="text-lg font-serif font-light ml-4" style={{ color: 'rgb(45, 48, 46)' }}>
          {formatAmount(transaction.total_amount)}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mt-4"
          >
            <div className="pt-4 mt-4 border-t border-accent/10 space-y-3">
              <div className="text-sm text-accent/70">
                <div>Split: {transaction.split_type}</div>
                {transaction.line_items && transaction.line_items.length > 0 && (
                  <div className="mt-2">
                    <div className="font-medium mb-1">Line Items:</div>
                    {(transaction.line_items as any[]).map((item, idx) => (
                      <div key={idx} className="text-xs ml-2">
                        {item.description}: {formatAmount(item.amount)} ({item.category})
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {canEdit && (
                <div className="flex gap-2 pt-2">
                  {onEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit()
                      }}
                      className="text-sm text-accent/60 hover:text-accent"
                    >
                      Edit
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete()
                      }}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
