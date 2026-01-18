import OpenAI from 'openai'
import { TransactionParsedSchema, TransactionParsed } from './schemas'
import { PARSE_TRANSACTION_PROMPT, OCR_RECEIPT_PROMPT } from './prompts'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function parseTransactionText(
  text: string,
  memberNames: string[] = []
): Promise<TransactionParsed> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `${PARSE_TRANSACTION_PROMPT}\n\nIMPORTANT: Available member names (payer_name MUST match one of these exactly): ${memberNames.length > 0 ? memberNames.join(', ') : 'None yet'}. If a name is mentioned in the transaction, match it to the closest available member name.`,
      },
      {
        role: 'user',
        content: `Parse this transaction and return JSON: ${text}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from AI')
  }

  let parsed
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    console.error('Failed to parse JSON response:', content)
    throw new Error(`Invalid JSON response from AI: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Log the parsed response for debugging
  console.log('AI parsed response:', JSON.stringify(parsed, null, 2))

  try {
    return TransactionParsedSchema.parse(parsed)
  } catch (error) {
    console.error('Zod validation error. AI returned:', JSON.stringify(parsed, null, 2))
    throw error
  }
}

export async function parseReceiptImage(
  imageBase64: string,
  memberNames: string[] = []
): Promise<TransactionParsed> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `${OCR_RECEIPT_PROMPT}\n\nIMPORTANT: Available member names (payer_name and split_among names MUST match one of these exactly): ${memberNames.length > 0 ? memberNames.join(', ') : 'None yet'}. If a name is mentioned in the receipt, match it to the closest available member name.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract transaction details and line items from this receipt. Return your response as JSON.',
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
            },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from AI')
  }

  let parsed
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    console.error('Failed to parse JSON response:', content)
    throw new Error(`Invalid JSON response from AI: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Log the parsed response for debugging
  console.log('AI parsed response (receipt):', JSON.stringify(parsed, null, 2))

  try {
    return TransactionParsedSchema.parse(parsed)
  } catch (error) {
    console.error('Zod validation error. AI returned:', JSON.stringify(parsed, null, 2))
    throw error
  }
}
