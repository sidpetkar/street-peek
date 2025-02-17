'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

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
    // Check if script is already loaded
    if (window.google?.maps) {
      setIsLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places&callback=initMap`
    script.async = true
    script.defer = true

    // Define the callback
    window.initMap = () => {
      setIsLoaded(true)
    }

    script.onerror = () => {
      setLoadError(new Error('Failed to load Google Maps'))
    }

    document.head.appendChild(script)

    return () => {
      // Cleanup
      window.initMap = undefined
    }
  }, [])

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  )
}

export const useGoogleMaps = () => useContext(GoogleMapsContext) 
