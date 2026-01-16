# Squared

A minimalist, AI-powered PWA for trip expense tracking.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
OPENAI_API_KEY=your_openai_api_key
```

3. Set up Supabase:
   - Create a new Supabase project
   - Run the migration in `supabase/migrations/001_initial_schema.sql`
   - Create a storage bucket named `receipts` with public read access

4. Run the development server:
```bash
npm run dev
```

## Features

- **Quick-Add**: Natural language transaction entry with AI parsing
- **Receipt OCR**: Snap a photo of a receipt for automatic extraction
- **Live Feed**: Real-time transaction updates
- **Settlement**: Optimal path algorithm for debt resolution
- **PWA**: Installable as a native app**

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion
- Supabase (PostgreSQL, Storage, Realtime)
- OpenAI GPT-4o-mini
