'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyDLgQPoTHR9xEFCJOSBO5qZLu4NwvmD3h0'

interface GoogleMapsContextType {
  isLoaded: boolean
  loadError: Error | null
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({
  isLoaded: false,
  loadError: null
})

export function GoogleMapsProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)

  useEffect(() => {
    if (!MAPS_API_KEY) {
      setLoadError(new Error('Google Maps API key is not configured'))
      return
    }

    if (window.google || document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
      setIsLoaded(true)
      return
    }

    // Create a callback function for async loading
    const callbackName = `initGoogleMaps${Date.now()}`
    ;(window as any)[callbackName] = () => {
      setIsLoaded(true)
      delete (window as any)[callbackName]
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places&callback=${callbackName}&loading=async`
    script.async = true
    script.defer = true

    script.onerror = () => {
      setLoadError(new Error('Failed to load Google Maps'))
      delete (window as any)[callbackName]
    }

    document.head.appendChild(script)

    return () => {
      // Cleanup if component unmounts
      delete (window as any)[callbackName]
    }
  }, [])

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  )
}

export const useGoogleMaps = () => useContext(GoogleMapsContext) 
