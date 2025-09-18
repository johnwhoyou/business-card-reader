'use client'

import { useState, useRef } from 'react'
import { Camera, Upload, Save, RotateCcw, Loader2, CheckCircle, Plus } from 'lucide-react'
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
  const [showSuccessActions, setShowSuccessActions] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isCameraLoading, setIsCameraLoading] = useState(false)

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
    setIsCameraLoading(true)
    setError('')
    try {
      // Debug information
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isAndroid = /Android/.test(navigator.userAgent)
      const isMobile = isIOS || isAndroid
      const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
      const safariVersion = isIOS && isSafari ? navigator.userAgent.match(/Version\/(\d+)/)?.[1] : null
      const iosVersion = isIOS ? navigator.userAgent.match(/OS (\d+)_/)?.[1] : null
      const isModernIOS = iosVersion ? parseInt(iosVersion) >= 11 : false
      
      console.log('Browser info:', {
        userAgent: navigator.userAgent,
        isIOS,
        isAndroid,
        isMobile,
        isSafari,
        safariVersion,
        iosVersion,
        isModernIOS,
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
                         window.location.hostname === '::1'
      
      const isHTTPS = window.location.protocol === 'https:'
      const isSecureContext = window.isSecureContext || isLocalhost || isHTTPS
      
      if (!isSecureContext) {
        if (isIOS) {
          setError('Camera requires HTTPS on iOS. Please make sure you\'re accessing the site via HTTPS.')
        } else {
          setError('Camera requires HTTPS. Please use a secure connection or localhost.')
        }
        setIsCameraLoading(false)
        return
      }

      // Ensure the <video> element is mounted before we attach the stream
      setIsCameraOpen(true)
      // Wait a tick for React to render the video element so ref is available
      await new Promise(resolve => setTimeout(resolve, 0))

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // For iOS Safari, we need to check for the modern API first
        if (isIOS && window.isSecureContext) {
          // Modern iOS Safari should have mediaDevices
          if (!navigator.mediaDevices) {
            if (isSafari) {
              setError(`Camera API not available. Please update Safari to version 11 or later. Current version: ${safariVersion || 'unknown'}`)
            } else {
              if (isModernIOS) {
                setError('Please use Safari browser on iOS for camera access. Chrome and other browsers don\'t support camera on iOS. Your iPhone supports camera access - just switch to Safari.')
              } else {
                setError('Please use Safari browser on iOS for camera access. Chrome and other browsers don\'t support camera on iOS.')
              }
            }
            setIsCameraLoading(false)
            setIsCameraOpen(false)
            return
          }
          
          if (!navigator.mediaDevices.getUserMedia) {
            if (isSafari) {
              setError(`Camera access not supported in Safari version ${safariVersion || 'unknown'}. Please update to Safari 11 or later.`)
            } else {
              setError('Please use Safari browser on iOS for camera access. Chrome and other browsers don\'t support camera on iOS.')
            }
            setIsCameraLoading(false)
            setIsCameraOpen(false)
            return
          }
        } else {
          // Try legacy getUserMedia as fallback for older browsers
          const legacyGetUserMedia = navigator.getUserMedia || 
                                   (navigator as any).webkitGetUserMedia || 
                                   (navigator as any).mozGetUserMedia || 
                                   (navigator as any).msGetUserMedia
          
          if (!legacyGetUserMedia) {
            if (isIOS) {
              setError('Camera not supported. Please use Safari on iOS (not Chrome or other browsers).')
            } else {
              setError('Camera not supported on this device. Please try a modern browser.')
            }
            setIsCameraLoading(false)
            setIsCameraOpen(false)
            return
          }
        }
        
        // If we reach here and need legacy getUserMedia, use it
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          const legacyGetUserMedia = navigator.getUserMedia || 
                                   (navigator as any).webkitGetUserMedia || 
                                   (navigator as any).mozGetUserMedia || 
                                   (navigator as any).msGetUserMedia
          
          if (legacyGetUserMedia) {
            console.log('Using legacy getUserMedia')
            legacyGetUserMedia.call(navigator, 
              { video: true }, 
              async (stream: MediaStream) => {
                if (videoRef.current) {
                  const video = videoRef.current
                  console.log('Legacy: Setting stream on video element:', {
                    videoElement: video,
                    stream: stream,
                    streamActive: stream.active,
                    streamTracks: stream.getTracks().map(track => ({
                      kind: track.kind,
                      enabled: track.enabled,
                      readyState: track.readyState,
                      muted: track.muted
                    }))
                  })
                  
                  // Try multiple methods to set the video source
                  try {
                    video.srcObject = stream
                  } catch (e) {
                    console.warn('Legacy: srcObject not supported, trying createObjectURL fallback')
                    // Fallback for older browsers
                    if ('mozSrcObject' in video) {
                      (video as any).mozSrcObject = stream
                    } else {
                      video.src = URL.createObjectURL(stream as any)
                    }
                  }
                  
                  try {
                    console.log('Legacy: Attempting to play video...')
                    await video.play()
                    
                    console.log('Legacy: Video play successful:', {
                      paused: video.paused,
                      currentTime: video.currentTime,
                      videoWidth: video.videoWidth,
                      videoHeight: video.videoHeight,
                      readyState: video.readyState
                    })
                    
                    setIsCameraOpen(true)
                    setError('')
                    setIsCameraLoading(false)
                    console.log('Legacy camera stream started successfully')
                  } catch (playError) {
                    console.error('Legacy video play error:', playError)
                    setError('Unable to start camera preview. Please try again.')
                    stream.getTracks().forEach(track => track.stop())
                    setIsCameraLoading(false)
                    setIsCameraOpen(false)
                  }
                }
              },
              (error: any) => {
                console.error('Legacy camera error:', error)
                setError('Camera access failed. Please try Safari or Chrome on iOS.')
                setIsCameraLoading(false)
                setIsCameraOpen(false)
              }
            )
            return
          }
        }
      }

      // Try different camera configurations - iOS Safari optimized
      let stream: MediaStream | undefined
      const constraints = isIOS ? [
        // iOS Safari: Start with basic back camera (most reliable)
        { 
          video: { 
            facingMode: 'environment'
          }
        },
        // iOS Safari: Basic front camera
        { 
          video: { 
            facingMode: 'user'
          }
        },
        // iOS Safari: Simple video constraint
        { 
          video: true 
        },
        // iOS Safari: Back camera with minimal constraints
        { 
          video: { 
            facingMode: { ideal: 'environment' },
            width: { max: 1920 },
            height: { max: 1080 }
          }
        }
      ] : [
        // Non-iOS: Try back camera with high quality
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

      if (!stream) {
        throw lastError || new Error('No camera available')
      }

      if (videoRef.current) {
        const video = videoRef.current
        console.log('Setting stream on video element:', {
          videoElement: video,
          stream: stream,
          streamActive: stream.active,
          streamTracks: stream.getTracks().map(track => ({
            kind: track.kind,
            enabled: track.enabled,
            readyState: track.readyState,
            muted: track.muted
          }))
        })
        
        // Try multiple methods to set the video source
        try {
          video.srcObject = stream
        } catch (e) {
          console.warn('srcObject not supported, trying createObjectURL fallback')
          // Fallback for older browsers
          if ('mozSrcObject' in video) {
            (video as any).mozSrcObject = stream
          } else {
            video.src = URL.createObjectURL(stream as any)
          }
        }
        
        // Add event listeners for debugging
        video.addEventListener('loadstart', () => console.log('Video: loadstart'))
        video.addEventListener('loadedmetadata', () => {
          console.log('Video: loadedmetadata', {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            duration: video.duration
          })
        })
        video.addEventListener('loadeddata', () => console.log('Video: loadeddata'))
        video.addEventListener('canplay', () => console.log('Video: canplay'))
        video.addEventListener('canplaythrough', () => console.log('Video: canplaythrough'))
        video.addEventListener('playing', () => console.log('Video: playing'))
        video.addEventListener('pause', () => console.log('Video: pause'))
        video.addEventListener('error', (e) => console.error('Video: error', e))
        
        // Explicitly play the video after setting the stream
        try {
          console.log('Attempting to play video...')
          const playPromise = video.play()
          await playPromise
          
          console.log('Video play successful:', {
            paused: video.paused,
            currentTime: video.currentTime,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState
          })
          
          // Set camera as open immediately
          setIsCameraOpen(true)
          setError('')
          setIsCameraLoading(false)
          
          // Check if video actually has dimensions after a short delay
          setTimeout(() => {
            if (video.videoWidth === 0 || video.videoHeight === 0) {
              console.warn('Video has no dimensions, might not be displaying properly')
              setError('Camera preview not showing. Try refreshing or using a different browser.')
            } else {
              console.log('Video dimensions confirmed:', {
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight
              })
            }
          }, 2000)
          
          console.log('Camera stream started successfully')
        } catch (playError) {
          console.error('Video play error:', playError)
          setError('Unable to start camera preview. Please try again.')
          // Stop the stream if play fails
          stream.getTracks().forEach(track => track.stop())
          setIsCameraLoading(false)
          setIsCameraOpen(false)
          return
        }
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
    } finally {
      setIsCameraLoading(false)
      // If there is no active video stream, ensure camera UI is closed
      if (!videoRef.current?.srcObject) {
        setIsCameraOpen(false)
      }
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
      setIsCameraOpen(false)
    }
  }

  const refreshCamera = async () => {
    console.log('Refreshing camera...')
    stopCamera()
    // Wait a moment before restarting
    setTimeout(() => {
      startCamera()
    }, 500)
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
      
      // Extract data using OCR
      const extractedData = await extractTextFromImage(imageDataUrl)
      setProcessingProgress(60)
      
      // Check if we got structured data or raw text
      let parsedData: BusinessCardData
      if (typeof extractedData === 'object' && extractedData !== null) {
        // We got structured data directly from AI
        console.log('✅ Using structured data from AI')
        parsedData = extractedData as BusinessCardData
      } else {
        // We got raw text, use the old parser as fallback
        console.log('📝 Using fallback text parser')
        parsedData = parseBusinessCardData(extractedData as string)
      }
      
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
    setSuccess('')
    setShowSuccessActions(false)
    
    try {
      await saveToAirtable(businessCardData)
      setSuccess('✅ Successfully saved to Airtable!')
      setShowSuccessActions(true)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to save to Airtable: ${errorMessage}. Please check your configuration and try again.`)
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
    setShowSuccessActions(false)
    setProcessingProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const processNewCard = () => {
    resetAll()
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
                      disabled={isCameraLoading}
                    >
                      {isCameraLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Starting Camera...
                        </>
                      ) : (
                        isCameraOpen ? 'Stop Camera' : 'Open Camera'
                      )}
                    </Button>
                    
                    {isCameraOpen && (
                      <div className="relative bg-black rounded-lg overflow-hidden shadow-lg max-w-sm mx-auto">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          controls={false}
                          className="w-full h-auto object-cover block"
                          style={{ 
                            minHeight: '240px',
                            maxHeight: '400px',
                            backgroundColor: '#000'
                          }}
                          onLoadedMetadata={(e) => {
                            const video = e.target as HTMLVideoElement
                            console.log('Camera ready - video metadata loaded:', {
                              videoWidth: video.videoWidth,
                              videoHeight: video.videoHeight,
                              currentTime: video.currentTime,
                              duration: video.duration,
                              readyState: video.readyState,
                              paused: video.paused
                            })
                          }}
                          onCanPlay={(e) => {
                            const video = e.target as HTMLVideoElement
                            console.log('Camera ready - can play:', {
                              videoWidth: video.videoWidth,
                              videoHeight: video.videoHeight,
                              readyState: video.readyState
                            })
                          }}
                          onPlaying={(e) => {
                            const video = e.target as HTMLVideoElement
                            console.log('Video is now playing:', {
                              videoWidth: video.videoWidth,
                              videoHeight: video.videoHeight,
                              currentTime: video.currentTime
                            })
                          }}
                          onError={(e) => {
                            console.error('Video error:', e)
                            const video = e.target as HTMLVideoElement
                            console.error('Video error details:', {
                              error: video.error,
                              networkState: video.networkState,
                              readyState: video.readyState
                            })
                            setError('Camera error. Please try again.')
                            stopCamera()
                          }}
                        />
                        
                        {/* Fallback message if video doesn't show */}
                        <div className="absolute inset-0 flex items-center justify-center text-white text-sm bg-gray-800 bg-opacity-50" 
                             style={{ 
                               display: (videoRef.current?.videoWidth || 0) > 0 ? 'none' : 'flex'
                             }}>
                          <div className="text-center">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                            <p>Loading camera preview...</p>
                          </div>
                        </div>
                        
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                          <Button
                            onClick={capturePhoto}
                            size="lg"
                            className="bg-white hover:bg-gray-50 text-slate-700 border shadow-lg rounded-full p-3"
                          >
                            <Camera className="w-6 h-6" />
                          </Button>
                        </div>
                        <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                          <Button
                            onClick={refreshCamera}
                            size="sm"
                            variant="ghost"
                            className="text-white bg-black bg-opacity-50 hover:bg-opacity-70 text-xs px-2 py-1 h-auto"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Refresh
                          </Button>
                          <p className="text-xs text-white bg-black bg-opacity-50 rounded px-2 py-1 text-center flex-1 mx-2">
                            Position the business card in the frame and tap the camera button
                          </p>
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
                    disabled={isSaving || !businessCardData.name || showSuccessActions}
                    className={cn(
                      "w-full text-white transition-all duration-200",
                      showSuccessActions 
                        ? "bg-green-600 hover:bg-green-700" 
                        : "bg-black hover:bg-gray-800"
                    )}
                    size="lg"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      </>
                    ) : showSuccessActions ? (
                      <>
                        Saved
                      </>
                    ) : (
                      <>
                        Save to Airtable
                      </>
                    )}
                  </Button>
                  
                  {showSuccessActions && (
                    <Button
                      onClick={processNewCard}
                      className="w-full bg-black hover:bg-gray-800 text-white mt-3"
                      size="lg"
                    >
                      Process New Card
                    </Button>
                  )}
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