'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'

export default function Navigation() {
  const pathname = usePathname()

  const navItems = [
    { path: '/', label: 'Add' },
    { path: '/feed', label: 'LEDGER' },
    { path: '/settle', label: 'BALANCE' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-base border-t border-accent/20 z-40 shadow-lg">
      <div className="flex justify-around items-center h-16 px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.path
          return (
            <Link key={item.path} href={item.path}>
              <motion.div
                className={`text-sm font-semibold tracking-wide relative ${
                  isActive ? 'text-accent' : 'text-accent/50'
                }`}
                whileHover={{ scale: 1.05, color: 'rgba(45, 48, 46, 1)' }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.15 }}
              >
                {item.label}
                {isActive && (
                  <motion.div
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent"
                    layoutId="activeTab"
                    transition={{ duration: 0.15 }}
                  />
                )}
              </motion.div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
