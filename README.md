# Squared

A minimalist, AI-powered Progressive Web App for tracking group trip expenses. Split bills effortlessly with natural language input, receipt OCR, and real-time collaboration.

## Features

### 🤖 AI-Powered Transaction Entry
- **Natural Language Parsing**: Type transactions in plain English like "Dinner $80 split equally" or "Groceries $124.50, Alice paid"
- **Receipt OCR**: Snap a photo of a receipt and automatically extract line items, amounts, and categories
- **Smart Allocation**: AI intelligently assigns receipt items to specific people when detected

### 📊 Comprehensive Ledger
- **Search & Filter**: Quickly find transactions by description, payer, or amount
- **CSV Export**: Export all transactions with date/time, payer, amount, and split type for spreadsheet analysis
- **Real-time Updates**: See transactions appear instantly as they're added by any group member

### ✂️ Flexible Splitting
- **Equal Split**: Default to splitting expenses equally among all members
- **Custom Splits**: Manually assign amounts per person or use natural language ("Alice pays $20, Bob pays $15, rest split equally")
- **Receipt Item Allocation**: For receipts, assign individual line items to specific people

### 💰 Smart Settlement
- **Optimal Debt Resolution**: Advanced algorithm calculates the minimum number of transactions needed to settle all debts
- **Visual Settlement View**: See exactly who owes whom and how much

### 📱 Progressive Web App
- **Installable**: Add to home screen on iOS and Android
- **Offline Capable**: Core features work without internet connection
- **Native Feel**: Standalone app experience with custom theme and icons

### 🎨 Beautiful UI
- **Minimalist Design**: Clean, serif typography with subtle animations
- **Real-time Feed**: Live transaction updates with smooth transitions
- **Category Analytics**: Visualize spending by category with interactive charts

## Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Animations**: Framer Motion
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **Storage**: Supabase Storage for receipt images
- **AI**: OpenAI GPT-4o-mini for transaction parsing and OCR
- **PWA**: next-pwa for service worker and offline support
- **Charts**: Recharts for spending visualizations

## Key Components

- **QuickAdd**: Natural language transaction input with AI parsing
- **CameraButton**: Receipt photo capture with OCR processing
- **LiveFeed**: Real-time transaction ledger with search and export
- **TransactionEditForm**: Enhanced editor with receipt line item allocation and custom split editing
- **SettlementView**: Optimal debt resolution visualization
- **SpendingStats**: Category-based spending analytics with pie charts

## Getting Started

See [SETUP.md](./SETUP.md) for detailed installation and configuration instructions.

## Development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` to see the app.

## Deployment

Squared is optimized for deployment on Vercel. See [SETUP.md](./SETUP.md) for production deployment details.
