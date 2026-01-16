'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface CategoryData {
  category: string
  amount: number
  percentage: number
}

interface CategoryPieChartProps {
  data: CategoryData[]
}

const COLORS = ['#2D302E', '#D1E8E2', '#2D302E80', '#D1E8E280', '#2D302E40', '#D1E8E240']

export default function CategoryPieChart({ data }: CategoryPieChartProps) {
  if (data.length === 0) {
    return (
      <div className="px-6 py-4 text-center text-accent/60">
        No category data available
      </div>
    )
  }

  const chartData = data.map((item) => ({
    name: item.category,
    value: item.amount,
    percentage: item.percentage,
  }))

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      return (
        <div className="bg-base border border-accent/20 rounded-lg p-3 shadow-lg">
          <p className="font-serif font-medium text-accent">{data.name}</p>
          <p className="text-sm text-accent/70">{formatCurrency(data.value)}</p>
          <p className="text-xs text-accent/60">{data.payload.percentage.toFixed(1)}%</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="px-6 py-4">
      <h3 className="text-lg font-serif font-semibold text-accent mb-4">Spending by Category</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ percentage }) => percentage > 5 ? `${percentage.toFixed(0)}%` : ''}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            stroke="#F9F9F8"
            strokeWidth={2}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            formatter={(value) => <span className="text-accent text-sm">{value}</span>}
            wrapperStyle={{ paddingTop: '20px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
