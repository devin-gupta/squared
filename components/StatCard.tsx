'use client'

import { motion } from 'framer-motion'

interface StatCardProps {
  label: string
  value: string | number
  isCurrency?: boolean
}

export default function StatCard({ label, value, isCurrency = false }: StatCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'number' && isCurrency) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(val)
    }
    return val.toString()
  }

  return (
    <motion.div
      className="bg-accent/8 border border-accent/20 rounded-lg p-4 shadow-sm"
      whileHover={{ scale: 1.02, backgroundColor: 'rgba(45, 48, 46, 0.12)', shadow: 'md' }}
      transition={{ duration: 0.15 }}
    >
      <div className="text-xs font-sans text-accent/70 uppercase tracking-wide mb-2 font-medium">
        {label}
      </div>
      <div className="text-2xl font-serif font-bold text-accent">
        {formatValue(value)}
      </div>
    </motion.div>
  )
}
