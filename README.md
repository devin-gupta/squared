# Squared

A minimalist, AI-powered Progressive Web App for tracking group trip expenses. Split bills effortlessly with natural language input, receipt OCR, and real-time collaboration.

## Features

### 🤖 AI-Powered Transaction Entry

- **Natural Language Parsing**: Type transactions in plain English like "Dinner $80 split equally" or "Groceries $124.50, Alice paid"
- **Receipt OCR**: Snap a photo of a receipt and automatically extract line items, amounts, and categories
- **Smart Allocation**: AI intelligently assigns receipt items to specific people when detected

### 📊 Comprehensive Ledger

- **Search & Filter**: Quickly find transactions by description, payer, or amount
- **CSV Export**: Export expense details plus each member's paid, share, and net amounts for equal, custom, and receipt-item splits
- **Real-time Updates**: See transactions appear instantly as they're added by any group member

### ✂️ Flexible Splitting

- **Equal Split**: Default to splitting expenses equally among all members
- **Custom Splits**: Manually assign amounts per person or use natural language ("Alice pays $20, Bob pays $15, rest split equally")
- **Receipt Item Allocation**: For receipts, assign individual line items to specific people

### 💰 Smart Settlement

- **Debt Simplification**: Suggested transfers help the group settle balances
- **Visual Settlement View**: Personal incoming, outgoing, and net totals; Venmo payment/request shortcuts. Opening Venmo does not record a repayment.

### 📱 Progressive Web App

- **Installable**: Add to home screen on iOS and Android
- **Offline Shell**: Cached pages may be available offline; saving and syncing expenses require a connection
- **Native Feel**: Standalone app experience with custom theme and icons

### 🎨 Beautiful UI

- **Minimalist Design**: Clean, serif typography with subtle animations
- **Real-time Feed**: Live transaction updates with smooth transitions
- **Category Analytics**: Visualize spending by category with interactive charts

## Tech Stack

- **Framework**: Next.js 15 (App Router) with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Animations**: Framer Motion
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **Storage**: Supabase Storage for receipt images
- **AI**: OpenRouter `openrouter/free` for server-side transaction parsing and OCR
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

The GitHub repository is connected to the existing Vercel project:

- Push or merge to `main` to deploy production at [squared-omega.vercel.app](https://squared-omega.vercel.app).
- Other branches receive Vercel preview deployments, subject to Vercel’s contributor authorization.
- [GitHub Actions CI](https://github.com/devin-gupta/squared/actions/workflows/ci.yml) runs on branch pushes and pull requests using Node.js 24 and `npm ci`.
- Both CI and Vercel run `npm run check`: regression tests, followed by the Next.js production build and type checks. A failed test or build prevents that Vercel deployment from replacing the live site.
- Deployment uses Vercel’s Git integration. No Vercel token or production API secret is stored in GitHub Actions. Secrets stay in Vercel; CI builds use nonfunctional placeholders.

Use Node.js 24 (`nvm use`), then run `npm ci` and `npm run check` locally before pushing. A local commit deploys only after it is pushed to GitHub. Database migrations are not applied automatically. See [SETUP.md](./SETUP.md) for environment configuration.
