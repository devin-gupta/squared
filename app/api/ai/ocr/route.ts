import { NextRequest, NextResponse } from 'next/server'
import { parseReceiptImage } from '@/lib/ai/parser'
import { supabase } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const tripId = formData.get('tripId') as string

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')

    // Get member names for context
    let memberNames: string[] = []
    if (tripId) {
      const { data: members } = await supabase
        .from('trip_members')
        .select('display_name')
        .eq('trip_id', tripId)

      if (members) {
        memberNames = members.map((m) => m.display_name)
      }
    }

    const parsed = await parseReceiptImage(base64, memberNames)

    // Upload receipt to Supabase Storage
    let receiptUrl: string | null = null
    if (tripId) {
      const fileName = `${tripId}/${Date.now()}-${file.name}`
      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(fileName, file, {
          contentType: file.type,
        })

      if (!error && data) {
        const { data: urlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(data.path)
        receiptUrl = urlData.publicUrl
      }
    }

    return NextResponse.json({ parsed, receiptUrl })
  } catch (error) {
    console.error('Error processing receipt:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process receipt' },
      { status: 500 }
    )
  }
}
