import Airtable from 'airtable'
import { BusinessCardData } from './text-parser'

function getAirtableBase() {
  if (!process.env.NEXT_PUBLIC_AIRTABLE_API_KEY) {
    throw new Error('Airtable API key is not configured')
  }
  if (!process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID) {
    throw new Error('Airtable Base ID is not configured')
  }
  
  const airtable = new Airtable({
    apiKey: process.env.NEXT_PUBLIC_AIRTABLE_API_KEY
  })
  
  return airtable.base(process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID)
}

export async function saveToAirtable(data: BusinessCardData): Promise<void> {
  console.log('🔍 Starting Airtable save process...')
  console.log('📊 Data to save:', JSON.stringify(data, null, 2))
  
  try {
    // Log environment variables (without exposing the actual values)
    console.log('🔑 Environment check:')
    console.log('- API Key configured:', !!process.env.NEXT_PUBLIC_AIRTABLE_API_KEY)
    console.log('- Base ID configured:', !!process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID)
    console.log('- Table Name:', process.env.NEXT_PUBLIC_AIRTABLE_TABLE_NAME || 'CRM (default)')
    
    const base = getAirtableBase()
    const tableName = process.env.NEXT_PUBLIC_AIRTABLE_TABLE_NAME || 'CRM'
    console.log('📋 Using table:', tableName)
    
    const recordData = {
      'Name': data.name || '',
      'Position': data.title || '',
      'Company': data.company || '',
      'Email': data.email || '',
      'Contact No.': data.phone || '',
      'Address': data.address || '',
      'Website': data.website || '',
      'Industry': data.industry || '',
      'Notes on Card': data.notes || ''
    }

    console.log('📝 Record data prepared:', JSON.stringify(recordData, null, 2))
    console.log('🚀 Attempting to create record in Airtable...')

    const result = await base(tableName).create([
      {
        fields: recordData
      }
    ])
    
    console.log('✅ Successfully saved to Airtable!')
    console.log('📄 Created record:', JSON.stringify(result, null, 2))
    
  } catch (error) {
    console.error('❌ Airtable save error details:')
    console.error('- Error type:', error?.constructor?.name)
    console.error('- Error message:', error instanceof Error ? error.message : 'Unknown error')
    console.error('- Full error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check for specific Airtable error types
    if (errorMessage.includes('Unauthorized')) {
      console.error('🔐 Authentication failed - check your API key')
    } else if (errorMessage.includes('Not Found')) {
      console.error('🔍 Base or table not found - check your Base ID and table name')
    } else if (errorMessage.includes('Invalid field')) {
      console.error('📋 Field name mismatch - check your table field names')
    }
    
    throw new Error(`Failed to save data to Airtable: ${errorMessage}`)
  }
}

export async function testAirtableConnection(): Promise<boolean> {
  console.log('🧪 Testing Airtable connection...')
  
  try {
    if (!process.env.NEXT_PUBLIC_AIRTABLE_API_KEY || !process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID) {
      console.error('❌ Missing environment variables for Airtable')
      return false
    }
    
    const base = getAirtableBase()
    const tableName = process.env.NEXT_PUBLIC_AIRTABLE_TABLE_NAME || 'CRM'
    console.log('📋 Testing connection to table:', tableName)
    
    // Try to fetch one record to test connection
    const result = await base(tableName).select({
      maxRecords: 1
    }).firstPage()
    
    console.log('✅ Airtable connection test successful!')
    console.log('📊 Test result:', result.length > 0 ? 'Found records' : 'No records found')
    return true
  } catch (error) {
    console.error('❌ Airtable connection test failed:')
    console.error('- Error type:', error?.constructor?.name)
    console.error('- Error message:', error instanceof Error ? error.message : 'Unknown error')
    console.error('- Full error:', error)
    return false
  }
}