"use client";

import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: string | number;
  isCurrency?: boolean;
}

export default function StatCard({
  label,
  value,
  isCurrency = false,
}: StatCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === "number" && isCurrency) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(val);
    }
    return val.toString();
  };

  return (
    <motion.div
      className="rounded-xl bg-[#f4f6ef] p-4"
      transition={{ duration: 0.15 }}
    >
      <div className="text-xs font-sans text-accent/70 uppercase tracking-wide mb-2 font-medium">
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums text-accent">
        {formatValue(value)}
      </div>
    </motion.div>
  );
}
