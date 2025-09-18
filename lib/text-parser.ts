export interface BusinessCardData {
  name?: string
  title?: string
  company?: string
  phone?: string
  email?: string
  website?: string
  address?: string
  industry?: string
  notes?: string
}

export function parseBusinessCardData(text: string): BusinessCardData {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  const data: BusinessCardData = {}
  
  // Email regex
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
  const emails = text.match(emailRegex)
  if (emails && emails.length > 0) {
    data.email = emails[0]
  }
  
  // Phone regex (various formats including international)
  const phoneRegexes = [
    // US format: (123) 456-7890 or 123-456-7890
    /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
    // International format: +65 1234 5678 or +65-1234-5678
    /(\+\d{1,3}[-.\s]?)?(\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,4})/g,
    // Singapore format: P 9833 2268
    /[Pp]\s*(\d{4}\s*\d{4})/g,
    // General phone pattern: digits with spaces, dashes, or dots
    /\b\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{2,4}\b/g
  ]
  
  for (const regex of phoneRegexes) {
    const phones = text.match(regex)
    if (phones && phones.length > 0) {
      let phone = phones[0].trim()
      // Clean up phone number format
      // Remove country code in parentheses like (+63)
      phone = phone.replace(/\(\+\d+\)\s*/, '')
      // Remove extra spaces and normalize
      phone = phone.replace(/\s+/g, ' ').trim()
      data.phone = phone
      break
    }
  }
  
  // Website regex
  const websiteRegex = /(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?/g
  const websites = text.match(websiteRegex)
  if (websites && websites.length > 0) {
    data.website = websites[0]
  }
  
  // Name detection (usually first line or line with common name patterns)
  const namePatterns = [
    /^[A-Z][a-z]+ [A-Z][a-z]+$/, // First Last
    /^[A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+$/, // First M. Last
    /^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+$/ // First Middle Last
  ]
  
  for (const line of lines) {
    if (namePatterns.some(pattern => pattern.test(line))) {
      data.name = line
      break
    }
  }
  
  // If no name pattern found, use first line as potential name
  if (!data.name && lines.length > 0) {
    const firstLine = lines[0]
    // Check if first line doesn't contain common business terms
    const businessTerms = ['inc', 'llc', 'corp', 'company', 'ltd', 'co', 'group', 'associates']
    const isBusinessTerm = businessTerms.some(term => 
      firstLine.toLowerCase().includes(term)
    )
    
    if (!isBusinessTerm && !emailRegex.test(firstLine) && !phoneRegexes.some(regex => regex.test(firstLine))) {
      data.name = firstLine
    }
  }
  
  // Title detection (common job titles)
  const titleKeywords = [
    'manager', 'director', 'president', 'ceo', 'cto', 'cfo', 'vp', 'vice president',
    'senior', 'lead', 'head', 'chief', 'executive', 'officer', 'coordinator',
    'specialist', 'analyst', 'consultant', 'advisor', 'developer', 'engineer',
    'designer', 'architect', 'supervisor', 'administrator'
  ]
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase()
    if (titleKeywords.some(keyword => lowerLine.includes(keyword))) {
      data.title = line
      break
    }
  }
  
  // Company detection (look for business indicators)
  const companyKeywords = [
    'inc', 'llc', 'corp', 'corporation', 'company', 'ltd', 'limited', 'co',
    'group', 'associates', 'partners', 'solutions', 'systems', 'technologies',
    'consulting', 'services', 'enterprises', 'ventures', 'finance', 'bank',
    'capital', 'investment', 'holdings', 'international', 'global'
  ]
  
  // First, try to find company by keywords
  for (const line of lines) {
    const lowerLine = line.toLowerCase()
    if (companyKeywords.some(keyword => lowerLine.includes(keyword))) {
      data.company = line
      break
    }
  }
  
  // If no company found by keywords, look for lines that contain business-like terms
  // but exclude email addresses and phone numbers
  if (!data.company) {
    for (const line of lines) {
      const lowerLine = line.toLowerCase()
      // Skip if it's an email, phone, or website
      if (emailRegex.test(line) || phoneRegexes.some(regex => regex.test(line)) || websiteRegex.test(line)) {
        continue
      }
      // Look for business-like terms
      if (lowerLine.includes('finance') || lowerLine.includes('company') || 
          lowerLine.includes('corp') || lowerLine.includes('inc') ||
          lowerLine.includes('ltd') || lowerLine.includes('group')) {
        data.company = line
        break
      }
    }
  }
  
  // Address detection (look for street patterns including various formats)
  const addressPatterns = [
    // US format: 123 Main Street, City, ST 12345
    /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd).*?(?:,\s*)?[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?/i,
    // Singapore format: 71 Ayer Rajah Crescent #05-01 Singapore 139951
    /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Crescent|Cres|Way|Place|Pl|Close|Cl|Terrace|Ter|Square|Sq|Park|Pk|Gardens|Gdns|Heights|Hts|View|Vw|Hill|Rise|Green|Grove|Valley|Vale|Meadows|Manor|Court|Ct).*?(?:#\d+-\d+)?\s*(?:Singapore|SGP)?\s*\d{6}/i,
    // Philippines format: 5F DMG Center, D. M. Guevara St.
    /\d+[A-Za-z]?\s+[A-Za-z\s]+(?:Center|Centre|Building|Bldg|Tower|Plaza|Mall|Complex|St|Street|Ave|Avenue|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Crescent|Cres|Way|Place|Pl|Close|Cl|Terrace|Ter|Square|Sq|Park|Pk|Gardens|Gdns|Heights|Hts|View|Vw|Hill|Rise|Green|Grove|Valley|Vale|Meadows|Manor|Court|Ct)/i,
    // General address pattern: number + street name
    /\d+[A-Za-z]?\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Crescent|Cres|Way|Place|Pl|Close|Cl|Terrace|Ter|Square|Sq|Park|Pk|Gardens|Gdns|Heights|Hts|View|Vw|Hill|Rise|Green|Grove|Valley|Vale|Meadows|Manor|Court|Ct|Center|Centre|Building|Bldg|Tower|Plaza|Mall|Complex)/i
  ]
  
  for (const line of lines) {
    if (addressPatterns.some(pattern => pattern.test(line))) {
      data.address = line
      break
    }
  }
  
  // Industry detection with specific Airtable options
  const industryOptions = [
    'Banking & Finance',
    'Investment & Private Equity',
    'Technology & Software',
    'Real Estate & Property Development',
    'Hospitality & Leisure',
    'Food & Beverage',
    'Professional Services',
    'Logistics & Transportation',
    'Retail & Consumer Goods',
    'Telecommunications',
    'Manufacturing & Industrial',
    'Education & Training',
    'Energy & Utilities',
    'Government & Nonprofit',
    'Media & Advertising',
    'Healthcare & Pharmaceutical',
    'Agriculture',
    'Personal Services'
  ]
  
  // Industry keyword mapping to Airtable options
  const industryKeywordMap: { [key: string]: string } = {
    'banking': 'Banking & Finance',
    'finance': 'Banking & Finance',
    'financial': 'Banking & Finance',
    'investment': 'Investment & Private Equity',
    'private equity': 'Investment & Private Equity',
    'venture capital': 'Investment & Private Equity',
    'vc': 'Investment & Private Equity',
    'technology': 'Technology & Software',
    'tech': 'Technology & Software',
    'software': 'Technology & Software',
    'it': 'Technology & Software',
    'real estate': 'Real Estate & Property Development',
    'property': 'Real Estate & Property Development',
    'development': 'Real Estate & Property Development',
    'hospitality': 'Hospitality & Leisure',
    'hotel': 'Hospitality & Leisure',
    'leisure': 'Hospitality & Leisure',
    'food': 'Food & Beverage',
    'beverage': 'Food & Beverage',
    'restaurant': 'Food & Beverage',
    'professional services': 'Professional Services',
    'consulting': 'Professional Services',
    'legal': 'Professional Services',
    'law': 'Professional Services',
    'logistics': 'Logistics & Transportation',
    'transportation': 'Logistics & Transportation',
    'shipping': 'Logistics & Transportation',
    'retail': 'Retail & Consumer Goods',
    'consumer goods': 'Retail & Consumer Goods',
    'telecommunications': 'Telecommunications',
    'telecom': 'Telecommunications',
    'manufacturing': 'Manufacturing & Industrial',
    'industrial': 'Manufacturing & Industrial',
    'education': 'Education & Training',
    'training': 'Education & Training',
    'energy': 'Energy & Utilities',
    'utilities': 'Energy & Utilities',
    'government': 'Government & Nonprofit',
    'nonprofit': 'Government & Nonprofit',
    'media': 'Media & Advertising',
    'advertising': 'Media & Advertising',
    'healthcare': 'Healthcare & Pharmaceutical',
    'medical': 'Healthcare & Pharmaceutical',
    'pharmaceutical': 'Healthcare & Pharmaceutical',
    'agriculture': 'Agriculture',
    'personal services': 'Personal Services'
  }
  
  // Check for exact industry option matches first
  for (const line of lines) {
    const exactMatch = industryOptions.find(option => 
      line.toLowerCase().includes(option.toLowerCase())
    )
    if (exactMatch) {
      data.industry = exactMatch
      break
    }
  }
  
  // If no exact match, try keyword mapping
  if (!data.industry) {
    for (const line of lines) {
      const lowerLine = line.toLowerCase()
      for (const [keyword, industry] of Object.entries(industryKeywordMap)) {
        if (lowerLine.includes(keyword)) {
          data.industry = industry
          break
        }
      }
      if (data.industry) break
    }
  }
  
  // Notes detection (capture any remaining relevant text)
  // This could be slogans, specializations, or other business info
  const usedLines = new Set([data.name, data.title, data.company, data.address, data.industry].filter(Boolean))
  const remainingLines = lines.filter(line => 
    !usedLines.has(line) && 
    !emailRegex.test(line) && 
    !phoneRegexes.some(regex => regex.test(line)) &&
    !websiteRegex.test(line) &&
    line.length > 3 && // Skip very short lines
    line.length < 100 // Skip very long lines that might be addresses
  )
  
  if (remainingLines.length > 0) {
    data.notes = remainingLines.join(' | ')
  }
  
  return data
}

export function cleanExtractedData(data: BusinessCardData): BusinessCardData {
  const cleaned: BusinessCardData = {}
  
  Object.entries(data).forEach(([key, value]) => {
    if (value && typeof value === 'string') {
      // Remove extra whitespace and clean up
      cleaned[key as keyof BusinessCardData] = value.trim().replace(/\s+/g, ' ')
    }
  })
  
  return cleaned
}