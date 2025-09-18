'use client'

import { useState, useRef } from 'react'
import { Camera, Upload, Save, RotateCcw, Loader2 } from 'lucide-react'
import { extractTextFromImage } from '@/lib/ocr'
import { parseBusinessCardData } from '@/lib/text-parser'
import { saveToAirtable } from '@/lib/airtable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

declare global {
  type NavigatorUserMediaSuccessCallback = (stream: MediaStream) => void;
  type NavigatorUserMediaErrorCallback = (error: MediaStreamError | any) => void;

  // Declare MediaStreamError for legacy getUserMedia compatibility
  interface MediaStreamError extends Error {
    name: 'PERMISSION_DENIED' | 'NOT_SUPPORTED_ERROR' | 'MANDATORY_UNSUPPORTED_ERROR' | 'INVALID_STATE_ERROR';
    message: string;
  }

  interface Navigator {
    getUserMedia: (options: MediaStreamConstraints, successCallback: NavigatorUserMediaSuccessCallback, errorCallback: NavigatorUserMediaErrorCallback) => void;
    webkitGetUserMedia: (options: MediaStreamConstraints, successCallback: NavigatorUserMediaSuccessCallback, errorCallback: NavigatorUserMediaErrorCallback) => void;
    mozGetUserMedia: (options: MediaStreamConstraints, successCallback: NavigatorUserMediaSuccessCallback, errorCallback: NavigatorUserMediaErrorCallback) => void;
    msGetUserMedia: (options: MediaStreamConstraints, successCallback: NavigatorUserMediaSuccessCallback, errorCallback: NavigatorUserMediaErrorCallback) => void;
  }
}

interface BusinessCardData {
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

export default function Home() {
  const [image, setImage] = useState<string | null>(null)
  const [businessCardData, setBusinessCardData] = useState<BusinessCardData>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [processingProgress, setProcessingProgress] = useState(0)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const imageDataUrl = e.target?.result as string
        setImage(imageDataUrl)
        setError('')
        setSuccess('')
        
        // Automatically process the image
        await processImageWithDataUrl(imageDataUrl)
      }
      reader.readAsDataURL(file)
    }
  }

  const startCamera = async () => {
    try {
      // Debug information
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isAndroid = /Android/.test(navigator.userAgent)
      const isMobile = isIOS || isAndroid
      
      console.log('Browser info:', {
        userAgent: navigator.userAgent,
        isIOS,
        isAndroid,
        isMobile,
        isSecureContext: window.isSecureContext,
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        hasLegacyGetUserMedia: !!((navigator as any).getUserMedia || (navigator as any).webkitGetUserMedia)
      })

      // Check if we're on HTTPS or localhost
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname.startsWith('192.168.') ||
                         window.location.hostname.startsWith('10.') ||
                         window.location.hostname.endsWith('.local')
      
      const isSecureContext = window.isSecureContext || isLocalhost
      
      if (!isSecureContext) {
        setError('Camera requires HTTPS. Please use a secure connection or localhost.')
        return
      }

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices) {
        // Try legacy getUserMedia as fallback
        const legacyGetUserMedia = navigator.getUserMedia || 
                                 (navigator as any).webkitGetUserMedia || 
                                 (navigator as any).mozGetUserMedia || 
                                 (navigator as any).msGetUserMedia
        
        if (!legacyGetUserMedia) {
          setError('Camera not supported on this device. Please try Safari or Chrome on iOS.')
          return
        }
        
        // Use legacy getUserMedia
        console.log('Using legacy getUserMedia')
        legacyGetUserMedia.call(navigator, 
          { video: true }, 
          (stream: MediaStream) => {
            if (videoRef.current) {
              videoRef.current.srcObject = stream
              setIsCameraOpen(true)
              setError('')
            }
          },
          (error: any) => {
            console.error('Legacy camera error:', error)
            setError('Camera access failed. Please try Safari or Chrome on iOS.')
          }
        )
        return
      }

      if (!navigator.mediaDevices.getUserMedia) {
        setError('Camera not supported on this device. Please try Safari or Chrome on iOS.')
        return
      }

      // Try different camera configurations
      let stream: MediaStream
      const constraints = [
        // Try back camera with high quality
        { 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        // Try back camera with basic settings
        { 
          video: { 
            facingMode: 'environment'
          }
        },
        // Try front camera with high quality
        { 
          video: { 
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        // Try front camera with basic settings
        { 
          video: { 
            facingMode: 'user'
          }
        },
        // Try any camera
        { 
          video: true 
        }
      ]

      let lastError: Error | null = null
      for (const constraint of constraints) {
        try {
          console.log('Trying camera constraint:', constraint)
          stream = await navigator.mediaDevices.getUserMedia(constraint)
          console.log('Camera access successful')
          break
        } catch (error) {
          console.log('Camera constraint failed:', error)
          lastError = error as Error
          continue
        }
      }

      if (!stream!) {
        throw lastError || new Error('No camera available')
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsCameraOpen(true)
        setError('')
      }
    } catch (err) {
      console.error('Camera error:', err)
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Camera access denied. Please allow camera permissions and try again.')
        } else if (err.name === 'NotFoundError') {
          setError('No camera found on this device.')
        } else if (err.name === 'NotSupportedError') {
          setError('Camera not supported on this device.')
        } else if (err.name === 'OverconstrainedError') {
          setError('Camera constraints not supported. Please try again.')
        } else {
          setError(`Unable to access camera: ${err.message}`)
        }
      } else {
        setError('Unable to access camera. Please check permissions and try again.')
      }
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      setIsCameraOpen(false)
    }
  }

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current
      const video = videoRef.current
      const context = canvas.getContext('2d')
      
      // Check if video is ready
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        setError('Camera not ready. Please wait a moment and try again.')
        return
      }
      
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      if (context) {
        // Draw the video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        // Convert to high-quality JPEG
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9)
        setImage(imageDataUrl)
        stopCamera()
        setError('')
        setSuccess('')
        
        // Automatically process the image
        await processImageWithDataUrl(imageDataUrl)
      } else {
        setError('Unable to capture photo. Please try again.')
      }
    } else {
      setError('Camera not available. Please try again.')
    }
  }

  const processImageWithDataUrl = async (imageDataUrl: string) => {
    if (!imageDataUrl) {
      console.error('❌ No image to process')
      return
    }
    
    setIsProcessing(true)
    setError('')
    setProcessingProgress(0)
    
    try {
      setProcessingProgress(20)
      
      // Extract text using OCR
      const text = await extractTextFromImage(imageDataUrl)
      setProcessingProgress(60)
      
      // Parse business card data
      const parsedData = parseBusinessCardData(text)
      setBusinessCardData(parsedData)
      setProcessingProgress(100)
      
    } catch (err) {
      console.error('❌ Image processing failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to process image: ${errorMessage}`)
    } finally {
      setIsProcessing(false)
      setTimeout(() => setProcessingProgress(0), 1000)
    }
  }

  const processImage = async () => {
    if (!image) {
      console.error('❌ No image to process')
      return
    }
    
    await processImageWithDataUrl(image)
  }

  const saveToAirtableHandler = async () => {
    if (!businessCardData.name) {
      setError('Please enter a name before saving.')
      return
    }
    
    setIsSaving(true)
    setError('')
    
    try {
      await saveToAirtable(businessCardData)
      setSuccess('Business card data saved to Airtable successfully!')
    } catch (err) {
      setError('Failed to save to Airtable. Please check your configuration.')
      console.error('Airtable Error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const resetAll = () => {
    setImage(null)
    setBusinessCardData({})
    setError('')
    setSuccess('')
    setProcessingProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const updateField = (field: keyof BusinessCardData, value: string) => {
    setBusinessCardData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Business Card Reader
          </h1>
          <p className="text-slate-600 text-sm md:text-base">
            Capture or upload a business card photo to extract and save contact information
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-700">
                <span className="text-sm">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}
        
        {success && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-green-700">
                <span className="text-sm">{success}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Business Card Reader
            </CardTitle>
            <CardDescription>
              Upload or capture a business card photo to automatically extract and edit the information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Image Capture Section */}
            <div className="space-y-4">
              {!image ? (
                <div className="space-y-4">
                  {/* Camera Section */}
                  <div className="text-center space-y-4">
                    <Button
                      onClick={isCameraOpen ? stopCamera : startCamera}
                      variant={isCameraOpen ? "destructive" : "default"}
                      className="w-full"
                      size="lg"
                    >
                      {isCameraOpen ? 'Stop Camera' : 'Open Camera'}
                    </Button>
                    
                    {isCameraOpen && (
                      <div className="relative">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full max-w-sm mx-auto rounded-lg shadow-lg"
                          onLoadedMetadata={() => {
                            console.log('Camera ready')
                          }}
                          onError={(e) => {
                            console.error('Video error:', e)
                            setError('Camera error. Please try again.')
                            stopCamera()
                          }}
                        />
                        <Button
                          onClick={capturePhoto}
                          size="lg"
                          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white hover:bg-gray-50 text-slate-700 border shadow-lg"
                        >
                          <Camera className="w-5 h-5" />
                        </Button>
                        <div className="text-center mt-2">
                          <p className="text-xs text-slate-500">Position the business card in the frame and tap the camera button</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-slate-500">or</span>
                    </div>
                  </div>

                  {/* File Upload Section */}
                  <div className="text-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      className="w-full"
                      size="lg"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Photo
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <img
                    src={image}
                    alt="Business card"
                    className="w-full max-w-md mx-auto rounded-lg shadow-md"
                  />
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={resetAll}
                      variant="outline"
                      size="lg"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {isProcessing && (
                    <div className="space-y-2">
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${processingProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-slate-600 text-center">
                        Processing image... {processingProgress}%
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Business Card Data Form */}
            {Object.keys(businessCardData).length > 0 && (
              <div className="space-y-6 pt-6 border-t">
                <h3 className="text-lg font-semibold text-slate-900">Business Card Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={businessCardData.name || ''}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="Enter name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Position</Label>
                    <Input
                      id="title"
                      value={businessCardData.title || ''}
                      onChange={(e) => updateField('title', e.target.value)}
                      placeholder="Enter position/title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={businessCardData.company || ''}
                      onChange={(e) => updateField('company', e.target.value)}
                      placeholder="Enter company name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={businessCardData.email || ''}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder="Enter email address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Contact No.</Label>
                    <Input
                      id="phone"
                      value={businessCardData.phone || ''}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={businessCardData.website || ''}
                      onChange={(e) => updateField('website', e.target.value)}
                      placeholder="Enter website URL"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={businessCardData.address || ''}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder="Enter address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      value={businessCardData.industry || ''}
                      onChange={(e) => updateField('industry', e.target.value)}
                      placeholder="Enter industry"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      value={businessCardData.notes || ''}
                      onChange={(e) => updateField('notes', e.target.value)}
                      placeholder="Additional notes"
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-4">
                  <Button
                    onClick={saveToAirtableHandler}
                    disabled={isSaving || !businessCardData.name}
                    className="w-full bg-black hover:bg-gray-800 text-white"
                    size="lg"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save to Airtable
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}