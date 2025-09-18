import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

export async function POST(request: NextRequest) {
  console.log('🔍 Starting OCR processing...')
  
  try {
    const { imageDataUrl } = await request.json()
    console.log('📸 Image data received:', imageDataUrl ? 'Yes' : 'No')
    console.log('📏 Image data length:', imageDataUrl?.length || 0)
    
    if (!imageDataUrl) {
      console.error('❌ No image provided')
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not configured')
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    console.log('🔑 OpenAI API key configured:', !!process.env.OPENAI_API_KEY)

    // Convert data URL to base64
    const base64Data = imageDataUrl.split(',')[1]
    console.log('📊 Base64 data length:', base64Data?.length || 0)
    
    if (!base64Data) {
      console.error('❌ Failed to extract base64 data from image')
      return NextResponse.json(
        { error: 'Invalid image format' },
        { status: 400 }
      )
    }

    console.log('🚀 Calling OpenAI Vision API...')
    
    const openai = getOpenAIClient()
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract all text from this business card image. Return ONLY the raw text content, do not format or structure it. Include everything you can read clearly.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
    })

    console.log('✅ OpenAI API response received')
    console.log('📄 Response choices:', response.choices?.length || 0)
    
    const extractedText = response.choices[0]?.message?.content || ''
    console.log('📝 Extracted text length:', extractedText.length)
    console.log('📝 Extracted text preview:', extractedText.substring(0, 100) + '...')
    
    return NextResponse.json({ 
      text: extractedText.trim(),
      success: true 
    })

} catch (error) {
    console.error('❌ OpenAI Vision API Error Details:')
    console.error('- Error type:', error?.constructor?.name)
    console.error('- Error message:', error instanceof Error ? error.message : 'Unknown error')
    console.error('- Error status:', (error as any)?.status)
    console.error('- Error code:', (error as any)?.code)
    console.error('- Full error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check for specific OpenAI error types
    if (errorMessage.includes('rate_limit')) {
      console.error('⏰ Rate limit exceeded - try again later')
    } else if (errorMessage.includes('quota')) {
      console.error('💰 Quota exceeded - check your OpenAI billing')
    } else if (errorMessage.includes('invalid_api_key')) {
      console.error('🔑 Invalid API key - check your OpenAI API key')
    } else if (errorMessage.includes('model_not_found')) {
      console.error('🤖 Model not found - check model name')
    }
    
    return NextResponse.json(
      { error: `Failed to extract text from image: ${errorMessage}` },
      { status: 500 }
    )
  }
}