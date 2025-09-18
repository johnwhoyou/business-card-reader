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
              text: `Extract business card information and return as JSON with these exact fields:
{
  "name": "Full name",
  "title": "Job title/position", 
  "company": "Company name",
  "phone": "Phone number(s)",
  "email": "Email address(es)",
  "website": "Website URL(s)",
  "address": "Full address",
  "industry": "Industry/sector",
  "notes": "Any additional text, taglines, or specializations"
}

Rules:
- If a field is not found, use null
- Include ALL phone numbers and emails if multiple exist (separate with commas)
- For industry, choose from: Banking & Finance, Investment & Private Equity, Technology & Software, Real Estate & Property Development, Hospitality & Leisure, Food & Beverage, Professional Services, Logistics & Transportation, Retail & Consumer Goods, Telecommunications, Manufacturing & Industrial, Education & Training, Energy & Utilities, Government & Nonprofit, Media & Advertising, Healthcare & Pharmaceutical, Agriculture, Personal Services
- For notes, include any remaining relevant text, taglines, or specializations
- Be as accurate as possible with the original text
- Return ONLY valid JSON, no markdown formatting, no code blocks, no other text`
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
    
    const extractedContent = response.choices[0]?.message?.content || ''
    console.log('📝 Extracted content length:', extractedContent.length)
    console.log('📝 Extracted content preview:', extractedContent.substring(0, 200) + '...')
    
    // Clean and parse the JSON response
    let parsedData
    try {
      // Remove markdown code blocks if present
      let cleanedContent = extractedContent.trim()
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      
      console.log('🧹 Cleaned content for parsing:', cleanedContent.substring(0, 200) + '...')
      
      parsedData = JSON.parse(cleanedContent.trim())
      console.log('✅ Successfully parsed JSON response')
      console.log('📊 Parsed data:', parsedData)
    } catch (parseError) {
      console.error('❌ Failed to parse JSON response:', parseError)
      console.log('📝 Raw response:', extractedContent)
      
      // Fallback: return the raw text for backward compatibility
      return NextResponse.json({ 
        text: extractedContent.trim(),
        success: true,
        fallback: true
      })
    }
    
    return NextResponse.json({ 
      data: parsedData,
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