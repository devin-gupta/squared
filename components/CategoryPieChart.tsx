"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { categoryLabel } from "@/lib/categories";

interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
}

interface CategoryPieChartProps {
  data: CategoryData[];
}

const COLORS = [
  "#355745",
  "#8B9E70",
  "#D4BE9B",
  "#8FA7B2",
  "#B5A4BC",
  "#D8E0CF",
  "#55705D",
  "#A8B78F",
  "#C89F76",
  "#6F8995",
  "#8D7D98",
  "#B9C4AE",
];

export default function CategoryPieChart({ data }: CategoryPieChartProps) {
  if (data.length === 0) {
    return (
      <div className="px-6 py-4 text-center text-accent/60">
        No category data available
      </div>
    );
  }

  const chartData = data.map((item) => ({
    name: categoryLabel(item.category),
    value: item.amount,
    percentage: item.percentage,
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-base border border-accent/20 rounded-lg p-3 shadow-lg">
          <p className="font-serif font-medium text-accent">{data.name}</p>
          <p className="text-sm text-accent/70">{formatCurrency(data.value)}</p>
          <p className="text-xs text-accent/60">
            {data.payload.percentage.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="panel min-w-0 p-6">
      <h3 className="text-[1rem] font-semibold text-accent mb-4">
        Spending by Category
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={96}
            fill="#8884d8"
            dataKey="value"
            stroke="#F9F9F8"
            strokeWidth={2}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
                aria-label={`${entry.name}: ${formatCurrency(entry.value)}, ${entry.percentage.toFixed(1)}%`}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="mt-4 divide-y divide-[#edf0e8]" aria-label="Category totals">
        {chartData.map((entry, index) => (
          <li
            key={entry.name}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-2 text-sm"
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
              aria-hidden="true"
            />
            <span className="min-w-0 text-accent">{entry.name}</span>
            <span className="text-right tabular-nums text-accent/70">
              {formatCurrency(entry.value)} · {entry.percentage.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
