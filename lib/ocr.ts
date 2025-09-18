export async function extractTextFromImage(imageDataUrl: string): Promise<string> {
  console.log('🔍 Starting OCR extraction from frontend...')
  console.log('📸 Image data URL length:', imageDataUrl?.length || 0)
  
  try {
    console.log('🚀 Making API call to /api/extract-text...')
    
    const response = await fetch('/api/extract-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageDataUrl }),
    })

    console.log('📡 API response status:', response.status)
    console.log('📡 API response ok:', response.ok)

    if (!response.ok) {
      const errorData = await response.json()
      console.error('❌ API error response:', errorData)
      throw new Error(errorData.error || 'Failed to extract text')
    }

    const data = await response.json()
    console.log('✅ OCR extraction successful!')
    
    // Handle new structured response
    if (data.data) {
      console.log('📊 Structured data received:', data.data)
      return data.data
    }
    
    // Handle fallback raw text response
    if (data.text) {
      console.log('📝 Fallback text received, length:', data.text?.length || 0)
      console.log('📝 Extracted text preview:', data.text?.substring(0, 100) + '...')
      return data.text
    }
    
    throw new Error('No data received from OCR service')
  } catch (error) {
    console.error('❌ OCR Error Details:')
    console.error('- Error type:', error?.constructor?.name)
    console.error('- Error message:', error instanceof Error ? error.message : 'Unknown error')
    console.error('- Full error:', error)
    throw new Error('Failed to extract text from image')
  }
}

export async function extractTextFromImageWithProgress(
  imageDataUrl: string,
  onProgress: (progress: number) => void
): Promise<string> {
  try {
    // Simulate progress for OpenAI API (it's much faster than Tesseract)
    onProgress(20)
    
    const response = await fetch('/api/extract-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageDataUrl }),
    })

    onProgress(80)

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to extract text')
    }

    const data = await response.json()
    onProgress(100)
    
    // Handle new structured response
    if (data.data) {
      return data.data
    }
    
    // Handle fallback raw text response
    if (data.text) {
      return data.text
    }
    
    throw new Error('No data received from OCR service')
  } catch (error) {
    console.error('OCR Error:', error)
    throw new Error('Failed to extract text from image')
  }
}