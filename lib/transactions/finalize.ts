import { supabase } from '../supabase/client'

export async function finalizeTransaction(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ status: 'finalized' })
    .eq('id', transactionId)

  if (error) {
    throw new Error(`Failed to finalize transaction: ${error.message}`)
  }
}
