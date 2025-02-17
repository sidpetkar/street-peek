'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useGoogleMaps } from '@/context/GoogleMapsContext'
import { LoadingDots } from './LoadingDots'
import { NearbyPlaces } from './NearbyPlaces'
import type { PlaceSearchResult, NearbyPlace } from '@/types/google-maps'

// Popular locations with guaranteed Street View coverage
const POPULAR_LOCATIONS = [
  { lat: 18.5204, lng: 73.8567, name: 'Pune, India' },
  { lat: 48.8584, lng: 2.2945, name: 'Eiffel Tower, Paris' },
  { lat: 40.7580, lng: -73.9855, name: 'Times Square, New York' },
  { lat: 51.5007, lng: -0.1246, name: 'Big Ben, London' },
  { lat: 35.6595, lng: 139.7004, name: 'Shibuya Crossing, Tokyo' },
  { lat: 25.1972, lng: 55.2744, name: 'Burj Khalifa, Dubai' }
]

// Update the placeholder texts
const PLACEHOLDER_TEXTS = [
  'landmarks',
  'cities',
  'restaurants',
  'beaches',
  'mountains',
  'museums',
  'parks',
  'stadiums',
  'hotels',
  'monuments'
]

// Add these constants at the top of the file
const RETRY_DELAY = 2000 // 2 seconds
const MAX_RETRIES = 3

// Add proper types for any
type GoogleCallback<T> = (result: T, status: google.maps.places.PlacesServiceStatus) => void;

// Add these types at the top of the file
type PlacesServiceCallback = (
  results: google.maps.places.PlaceResult[],
  status: google.maps.places.PlacesServiceStatus
) => void;

type AutocompleteResponse = {
  predictions: Array<{
    place_id: string;
    description: string;
  }>;
};

type StreetViewLocation = {
  lat(): number;
  lng(): number;
};

// Add proper types for Google Maps services
interface GoogleServices {
  autocompleteService: google.maps.places.AutocompleteService | null;
  placesService: google.maps.places.PlacesService | null;
}

// Update the component state types
interface StreetViewState {
  address: string;
  streetView: google.maps.StreetViewPanorama | null;
  error: string;
  isLoading: boolean;
  lastLocation: { lat: number; lng: number } | null;
  suggestions: PlaceSearchResult[];
  showSuggestions: boolean;
  showNearbyPlaces: boolean;
  nearbyPlaces: NearbyPlace[];
  initializing: boolean;
  rateLimitExceeded: boolean;
}

export default function StreetViewMap() {
  const { isLoaded, loadError } = useGoogleMaps()
  const [address, setAddress] = useState('')
  const [streetView, setStreetView] = useState<google.maps.StreetViewPanorama | null>(null)
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [suggestions, setSuggestions] = useState<PlaceSearchResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const services = useRef<GoogleServices>({
    autocompleteService: null,
    placesService: null
  })
  const [showNearbyPlaces, setShowNearbyPlaces] = useState(false)
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([])
  const [initializing, setInitializing] = useState(true)
  const [rateLimitExceeded, setRateLimitExceeded] = useState(false)
  const requestQueue = useRef<(() => Promise<unknown>)[]>([])
  const isProcessingQueue = useRef(false)

  // Update the findNearestStreetView function with proper types
  const findNearestStreetView = async (position: { lat: number; lng: number }): Promise<google.maps.LatLng | null> => {
    if (!window.google?.maps) return null

    try {
      const service = new window.google.maps.StreetViewService()
      const radii = [50, 100, 250, 500, 1000, 2000, 5000, 10000]
      
      for (const radius of radii) {
        try {
          const result = await service.getPanorama({
            location: position,
            radius: radius,
            preference: google.maps.StreetViewPreference.NEAREST,
            source: google.maps.StreetViewSource.OUTDOOR
          })
          
          if (result?.data?.location?.latLng) {
            return result.data.location.latLng
          }
        } catch {
          continue
        }
      }
      return null
    } catch (error) {
      console.error('Street View error:', error)
      return null
    }
  }

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'))
        return
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
        // Add these if needed for better accuracy
        // mozillaLocation: true,
        // enableHighPrecision: true
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Raw position:', position.coords)
          resolve(position)
        },
        (error) => {
          if (error instanceof Error) {
            console.error('Geolocation error:', error.message)
          } else {
            console.error('Unknown geolocation error')
          }
          reject(error)
        },
        options
      )
    })
  }

  // Add ESLint disable comment for the useEffect dependency
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!isLoaded) return

    let isMounted = true

    const initLocation = async () => {
      try {
        // Always try to get current location first
        const position = await getCurrentPosition().catch((error) => {
          console.error('Failed to get current location:', error)
          throw error // Re-throw to handle in catch block
        })

        if (isMounted) {
          const newPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
          console.log('Using current location:', newPosition)
          await initializeStreetView(newPosition)
          // Save current location as last known
          localStorage.setItem('lastKnownLocation', JSON.stringify(newPosition))
        }
      } catch (error) {
        // If current location fails, try last known location
        const savedLocation = localStorage.getItem('lastKnownLocation')
        if (savedLocation && isMounted) {
          try {
            const lastPosition = JSON.parse(savedLocation)
            console.log('Using saved location:', lastPosition)
            await initializeStreetView(lastPosition)
          } catch (err) {
            console.error('Failed to use saved location:', err)
            // If both fail, use default location
            if (isMounted) {
              console.log('Using default location (Pune)')
              await initializeStreetView(POPULAR_LOCATIONS[0])
            }
          }
        } else {
          // If no saved location, use default
          if (isMounted) {
            console.log('Using default location (Pune)')
            await initializeStreetView(POPULAR_LOCATIONS[0])
          }
        }
      } finally {
        if (isMounted) {
          setInitializing(false)
        }
      }
    }

    initLocation()

    return () => {
      isMounted = false
    }
  }, [isLoaded])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (isLoaded && window.google?.maps) {
      services.current.autocompleteService = new window.google.maps.places.AutocompleteService()
      services.current.placesService = new window.google.maps.places.PlacesService(
        document.createElement('div')
      )
    }
  }, [isLoaded])

  useEffect(() => {
    if (isLoaded && window.google?.maps) {
      // Initialize with popular locations
      const defaultSuggestions: PlaceSearchResult[] = POPULAR_LOCATIONS.map(loc => ({
        description: loc.name,
        place_id: `${loc.lat},${loc.lng}`,
        hasStreetView: true,
        score: 100,
        details: {
          geometry: {
            location: new google.maps.LatLng(loc.lat, loc.lng)
          }
        }
      }))
      setSuggestions(defaultSuggestions)
    }
  }, [isLoaded])

  const findNearbyPlaces = async (location: { lat: number; lng: number }) => {
    if (!window.google?.maps) return []

    try {
      const service = new window.google.maps.places.PlacesService(document.createElement('div'))
      
      // First try to find landmarks by distance
      const landmarkRequest = {
        location: new window.google.maps.LatLng(location.lat, location.lng),
        type: ['tourist_attraction', 'landmark'],
        rankBy: window.google.maps.places.RankBy.DISTANCE // When using DISTANCE, don't use radius
      }

      // Backup request for general points of interest
      const backupRequest = {
        location: new window.google.maps.LatLng(location.lat, location.lng),
        type: ['point_of_interest'],
        radius: 5000, // Only use radius when not using rankBy.DISTANCE
        keyword: 'attraction' // Add keyword to find interesting places
      }

      // Try both requests
      let results: google.maps.places.PlaceResult[] = []
      
      try {
        results = await new Promise<google.maps.places.PlaceResult[]>((resolve) => {
          service.nearbySearch(landmarkRequest, (places: google.maps.places.PlaceResult[], status: google.maps.places.PlacesServiceStatus) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && places) {
              resolve(places)
            } else {
              resolve([])
            }
          })
        })

        console.log('Landmark search results:', results)
      } catch (error) {
        console.log('Failed to find landmarks, trying backup search')
      }

      // If no landmarks found, try backup search
      if (results.length === 0) {
        results = await new Promise<google.maps.places.PlaceResult[]>((resolve) => {
          service.nearbySearch(
            backupRequest,
            (places: google.maps.places.PlaceResult[], status: google.maps.places.PlacesServiceStatus) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && places) {
                resolve(places)
              } else {
                resolve([])
              }
            }
          )
        })

        console.log('Backup search results:', results)
      }

      // If still no results, use city-based landmarks
      if (results.length === 0) {
        const geocoder = new window.google.maps.Geocoder()
        const cityResult = await geocoder.geocode({ location })
        
        if (cityResult.results[0]) {
          const cityName = cityResult.results[0].address_components.find(
            (component: { types: string[] }) => component.types.includes('locality')
          )?.long_name

          console.log('Found city:', cityName)

          // Predefined landmarks for major cities
          const cityLandmarks: Record<string, any[]> = {
            'Pune': [
              {
                name: 'Shaniwar Wada',
                description: 'Historic fortification and palace in Pune, built in 1732.',
                location: { lat: 18.5195, lng: 73.8553 },
                distance: '1.2 km',
                rating: 4.5,
                totalRatings: 1000
              },
              {
                name: 'Aga Khan Palace',
                description: 'Historic building and museum, significant for Indian independence movement.',
                location: { lat: 18.5516, lng: 73.9003 },
                distance: '2.5 km',
                rating: 4.4,
                totalRatings: 800
              },
              {
                name: 'Sinhagad Fort',
                description: 'Ancient mountain fortress with panoramic views.',
                location: { lat: 18.3664, lng: 73.7536 },
                distance: '3.8 km',
                rating: 4.6,
                totalRatings: 1200
              }
            ]
            // Add more cities as needed
          }

          if (cityName && cityLandmarks[cityName]) {
            console.log('Using predefined landmarks for:', cityName)
            return cityLandmarks[cityName]
          }
        }
      }

      // Process API results
      const detailedPlaces = await Promise.all(
        results.slice(0, 3).map(async (place) => {
          try {
            if (!place.place_id) return null

            const details = await new Promise<google.maps.places.PlaceResult>((resolve, reject) => {
              service.getDetails({
                placeId: place.place_id,
                fields: ['name', 'formatted_address', 'photos', 'geometry', 'rating', 'user_ratings_total', 'opening_hours']
              }, (result: google.maps.places.PlaceResult | null, status: google.maps.places.PlacesServiceStatus) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && result) {
                  resolve(result)
                } else {
                  reject(new Error(`Place details failed with status: ${status}`))
                }
              })
            })

            const distance = details.geometry?.location ? 
              window.google.maps.geometry.spherical.computeDistanceBetween(
                new window.google.maps.LatLng(location.lat, location.lng),
                details.geometry.location
              ) : 0;

            return {
              name: details.name || 'Unknown Place',
              description: details.formatted_address || '',
              location: {
                lat: details.geometry?.location?.lat() || 0,
                lng: details.geometry?.location?.lng() || 0
              },
              distance: `${(distance / 1000).toFixed(1)} km`,
              photos: details.photos || [],
              rating: details.rating,
              totalRatings: details.user_ratings_total,
              openNow: details.opening_hours?.isOpen?.() || false
            }
          } catch (error) {
            console.error('Error getting place details:', error)
            return null
          }
        })
      )

      const validPlaces = detailedPlaces.filter(Boolean)
      console.log('Final nearby places:', validPlaces)
      return validPlaces
    } catch (error) {
      console.error('Error finding nearby places:', error)
      return []
    }
  }

  const executeWithRateLimit = async (request: () => Promise<unknown>) => {
    try {
      if (rateLimitExceeded) {
        // Queue the request
        requestQueue.current.push(request)
        return null
      }

      const response = await request()
      return response
    } catch (error: any) {
      if (error?.message?.includes('429') || error?.status === 429) {
        console.log('Rate limit exceeded, queuing requests')
        setRateLimitExceeded(true)
        requestQueue.current.push(request)
        
        // Start processing queue after delay
        if (!isProcessingQueue.current) {
          isProcessingQueue.current = true
          setTimeout(async () => {
            setRateLimitExceeded(false)
            while (requestQueue.current.length > 0) {
              const nextRequest = requestQueue.current.shift()
              if (nextRequest) {
                try {
                  await nextRequest()
                  // Add delay between requests
                  await new Promise(resolve => setTimeout(resolve, 1000))
                } catch (err) {
                  console.error('Error processing queued request:', err)
                }
              }
            }
            isProcessingQueue.current = false
          }, 2000) // Wait 2 seconds before retrying
        }
        return null
      }
      throw error
    }
  }

  const initializeStreetView = async (position: { lat: number; lng: number }) => {
    try {
      setIsLoading(true)
      setShowNearbyPlaces(false)
      setError('')
      console.log('Initializing Street View at:', position)
      
      const streetViewLocation = await executeWithRateLimit(() => 
        findNearestStreetView(position)
      ) as StreetViewLocation | null
      
      if (!streetViewLocation) {
        console.log('Finding nearby places for:', position)
        const nearby = await findNearbyPlaces(position)
        
        if (nearby && nearby.length > 0) {
          console.log('Found nearby places:', nearby)
          setNearbyPlaces(nearby)
          setShowNearbyPlaces(true)
        } else {
          setError('No street view or nearby places found in this area')
        }
        setIsLoading(false)
        return
      }

      // Get address for the location
      const geocoder = new window.google.maps.Geocoder()
      const addressResult = await executeWithRateLimit(() => 
        geocoder.geocode({
          location: streetViewLocation
        })
      ) as google.maps.GeocoderResponse

      let retryCount = 0
      const createPanorama = async () => {
        try {
          const panorama = new window.google.maps.StreetViewPanorama(
            document.getElementById('street-view') as HTMLElement,
            {
              position: streetViewLocation,
              pov: { heading: 0, pitch: 0 },
              zoom: 1,
              addressControl: false,
              fullscreenControl: false,
              motionTracking: false,
              motionTrackingControl: false,
              showRoadLabels: false,
              visible: true,
              linksControl: true,
              panControl: false,
              zoomControl: false,
              enableCloseButton: false,
              disableDefaultUI: true
            }
          )

          // Set up rotation
          let currentHeading = 0
          let isAutoRotating = false
          let resumeTimeout: NodeJS.Timeout
          let animationFrame: number
          let isHandlingPov = false

          const rotate = () => {
            if (!panorama || !isAutoRotating) {
              cancelAnimationFrame(animationFrame)
              return
            }
            
            currentHeading = (currentHeading + 0.15) % 360
            isHandlingPov = true
            panorama.setPov({
              heading: currentHeading,
              pitch: panorama.getPov().pitch
            })
            isHandlingPov = false
            animationFrame = requestAnimationFrame(rotate)
          }

          const stopRotation = () => {
            isAutoRotating = false
            cancelAnimationFrame(animationFrame)
            if (resumeTimeout) {
              clearTimeout(resumeTimeout)
            }
            currentHeading = panorama.getPov().heading
          }

          const startRotationFromCurrentAngle = () => {
            currentHeading = panorama.getPov().heading
            isAutoRotating = true
            rotate()
          }

          // Handle mouse movement
          const handleMouseMove = () => {
            stopRotation() // Immediately stop rotation
            
            if (resumeTimeout) {
              clearTimeout(resumeTimeout)
            }
            
            resumeTimeout = setTimeout(() => {
              startRotationFromCurrentAngle()
            }, 1000)
          }

          // Add event listeners
          const element = document.getElementById('street-view')
          if (element) {
            element.addEventListener('mousemove', handleMouseMove)
            element.addEventListener('touchmove', handleMouseMove)
          }

          // Handle POV changes
          panorama.addListener('pov_changed', () => {
            if (!isHandlingPov) {
              currentHeading = panorama.getPov().heading
              stopRotation()
              
              if (resumeTimeout) {
                clearTimeout(resumeTimeout)
              }
              
              resumeTimeout = setTimeout(() => {
                startRotationFromCurrentAngle()
              }, 1000)
            }
          })

          // Add this after all the event listeners
          const formattedAddress = addressResult.results[0]?.formatted_address || 'Unknown location'
          const enhancedPanorama = Object.assign(panorama, {
            customDescription: formattedAddress
          })

          setStreetView(enhancedPanorama)

          // Start with static view
          panorama.addListener('status_changed', () => {
            if (panorama.getStatus() === 'OK') {
              stopRotation()
              resumeTimeout = setTimeout(() => {
                startRotationFromCurrentAngle()
              }, 1000)
            }
          })

          // Return the cleanup function
          return () => {
            isAutoRotating = false
            cancelAnimationFrame(animationFrame)
            clearTimeout(resumeTimeout)
            if (element) {
              element.removeEventListener('mousemove', handleMouseMove)
              element.removeEventListener('touchmove', handleMouseMove)
            }
          }
        } catch (error) {
          if (retryCount < MAX_RETRIES) {
            retryCount++
            console.log(`Retrying panorama creation (${retryCount}/${MAX_RETRIES})...`)
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
            return createPanorama()
          }
          throw error
        }
      }

      await createPanorama()

      if (streetViewLocation) {
        const newLocation = {
          lat: streetViewLocation.lat(),
          lng: streetViewLocation.lng()
        }
        setLastLocation(newLocation)
        localStorage.setItem('lastKnownLocation', JSON.stringify(newLocation))
      }

    } catch (err) {
      console.error('Error in initializeStreetView:', err)
      setError('Failed to load Street View. Please try again in a moment.')
    } finally {
      setIsLoading(false)
    }
  }

  // Update the handleAddressChange function with proper types
  const handleAddressChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const value = event.target.value
    setAddress(value)

    if (!value.trim() || !services.current.autocompleteService) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    try {
      const sessionToken = new google.maps.places.AutocompleteSessionToken()
      
      const response = (await executeWithRateLimit(() => 
        services.current.autocompleteService!.getPlacePredictions({
          input: value,
          types: ['geocode', 'establishment'],
          sessionToken,
        })
      )) as AutocompleteResponse | null

      if (!response) return // Handle rate limit case

      if (response?.predictions && response.predictions.length > 0) {
        const service = new window.google.maps.places.PlacesService(document.createElement('div'))
        const streetViewService = new window.google.maps.StreetViewService()

        // Get details for each prediction
        const detailedPredictions = await Promise.all(
          response.predictions.slice(0, 5).map(async (prediction: { place_id: string; description: string }) => {
            try {
              const details = await new Promise<google.maps.places.PlaceResult>((resolve, reject) => {
                service.getDetails({
                  placeId: prediction.place_id,
                  fields: ['geometry', 'name', 'formatted_address', 'types', 'photos'],
                  sessionToken
                }, (result: google.maps.places.PlaceResult | null, status: google.maps.places.PlacesServiceStatus) => {
                  if (status === google.maps.places.PlacesServiceStatus.OK && result) {
                    resolve(result)
                  } else {
                    reject(new Error('Place details not found'))
                  }
                })
              })

              if (!details.geometry?.location) {
                return { ...prediction, hasStreetView: false, score: 0 }
              }

              // Check for street view availability with larger initial radius
              let hasStreetView = false
              let streetViewLocation = null
              try {
                const response = await streetViewService.getPanorama({
                  location: details.geometry.location,
                  radius: 500, // Increased initial check radius
                  source: google.maps.StreetViewSource.DEFAULT
                })
                
                if (response?.data?.location?.latLng) {
                  hasStreetView = true
                  streetViewLocation = response.data.location.latLng
                }
              } catch (e) {
                hasStreetView = false
              }

              return {
                ...prediction,
                hasStreetView,
                streetViewLocation,
                details,
                score: hasStreetView ? 100 : 50
              }
            } catch (error) {
              console.log('Error getting details for prediction:', error)
              return { ...prediction, hasStreetView: false, score: 0 }
            }
          })
        )

        const sortedPredictions = detailedPredictions
          .sort((a: PlaceSearchResult, b: PlaceSearchResult) => (b.score || 0) - (a.score || 0));

        console.log('Sorted predictions with details:', sortedPredictions)
        setSuggestions(sortedPredictions)
        setShowSuggestions(true)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    } catch (error) {
      console.error('Autocomplete error:', error)
      setSuggestions([])
    }
  }

  // Update the handleSearchClick function
  const handleSearchClick = () => {
    setShowSuggestions(true)
    if (address.trim() && services.current.autocompleteService) {
      // Retrigger search with current value
      handleAddressChange({ target: { value: address } } as React.ChangeEvent<HTMLInputElement>)
    } else {
      // Show popular/recent suggestions when input is empty
      const defaultSuggestions: PlaceSearchResult[] = POPULAR_LOCATIONS.map(loc => ({
        description: loc.name,
        place_id: `${loc.lat},${loc.lng}`,
        hasStreetView: true,
        score: 100,
        details: {
          geometry: {
            location: new google.maps.LatLng(loc.lat, loc.lng)
          }
        }
      }))
      setSuggestions(defaultSuggestions)
    }
  }

  // Update handleSuggestionClick to handle custom place_ids
  const handleSuggestionClick = async (placeId: string, description: string) => {
    setAddress(description)
    setShowSuggestions(false)
    setIsLoading(true)

    try {
      // Check if it's a custom place_id (from POPULAR_LOCATIONS)
      if (placeId.includes(',')) {
        const [lat, lng] = placeId.split(',').map(Number)
        await initializeStreetView({ lat, lng })
        return
      }

      // Find the selected suggestion with its cached data
      const selectedSuggestion = suggestions.find(s => s.place_id === placeId)
      
      if (selectedSuggestion?.streetViewLocation) {
        // Use the cached street view location
        await initializeStreetView({
          lat: selectedSuggestion.streetViewLocation.lat(),
          lng: selectedSuggestion.streetViewLocation.lng()
        })
        return
      }

      // If no cached location, fall back to place details
      if (selectedSuggestion?.details?.geometry?.location) {
        const location = {
          lat: selectedSuggestion.details.geometry.location.lat(),
          lng: selectedSuggestion.details.geometry.location.lng()
        }
        await initializeStreetView(location)
        return
      }

      // Last resort: geocode the place ID
      const geocoder = new window.google.maps.Geocoder()
      const results = await geocoder.geocode({ placeId })
      
      if (results.results[0]?.geometry?.location) {
        const location = {
          lat: results.results[0].geometry.location.lat(),
          lng: results.results[0].geometry.location.lng()
        }
        await initializeStreetView(location)
      } else {
        throw new Error('Location not found')
      }
    } catch (err) {
      console.error('Error handling suggestion click:', err)
      setError('Failed to load location. Street View might not be available in this area.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!address || !window.google) return
    setIsLoading(true)
    
    try {
      const geocoder = new window.google.maps.Geocoder()
      const results = await geocoder.geocode({ address })
      
      if (results.results[0]) {
        const location = results.results[0].geometry.location
        await initializeStreetView({ lat: location.lat(), lng: location.lng() })
      } else {
        setError('Address not found')
      }
    } catch (err) {
      console.error('Geocoding error:', err)
      setError('Failed to find address')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle clear function
  const handleClear = async () => {
    setAddress('')
    setStreetView(null)
    setSuggestions([])
    setShowSuggestions(false)
    
    try {
      const position = await getCurrentPosition()
      const newPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }
      await initializeStreetView(newPosition)
    } catch (error) {
      console.error('Error getting current location:', error)
      await initializeStreetView(POPULAR_LOCATIONS[0])
    }
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="p-4 bg-red-100 w-full max-w-md">
          <p className="text-red-700 text-center">Failed to load Google Maps</p>
        </Card>
      </div>
    )
  }

  return (
    <>
      {/* Border fade overlay - slightly taller */}
      <div className="fixed inset-0 z-20 pointer-events-none">
        <div className="absolute inset-0">
          {/* Top fade only - increased height */}
          <div className="absolute top-0 left-0 right-0 h-[90px] bg-gradient-to-b from-black/40 to-transparent" />
        </div>
      </div>

      <div 
        ref={mapRef}
        id="street-view" 
        className={`w-full h-screen fixed top-0 left-0 transition-all duration-700 ease-in-out cursor-grab active:cursor-grabbing ${
          (showNearbyPlaces || (!initializing && isLoading)) 
            ? 'filter blur-md bg-gray-100/30'
            : 'filter blur-none'
        }`}
      />
      
      <div className="fixed top-4 left-0 right-0 z-40 px-4 md:px-8">
        <div className="max-w-[640px] mx-auto">
          <Card className="shadow-xl overflow-hidden bg-white/95 backdrop-blur-sm hover:shadow-2xl transition-shadow duration-200">
            {/* Location banner */}
            <div className="flex items-center h-[32px] relative px-4 border-b border-gray-50 bg-gray-200/50">
              <button 
                onClick={() => {
                  if (lastLocation) {
                    window.open(`https://www.google.com/maps?q=${lastLocation.lat},${lastLocation.lng}`, '_blank')
                  }
                }}
                className="flex items-center gap-1.5 hover:opacity-75 transition-opacity duration-150 w-full"
              >
                <div className="flex items-center gap-1.5 mx-auto">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="8" 
                    height="8" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    className="text-blue-600 flex-shrink-0"
                  >
                    <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/>
                  </svg>
                  <p className="text-[10px] text-blue-600 truncate max-w-[280px] md:max-w-[400px]">
                    {(streetView as any)?.customDescription || 'Loading location...'}
                  </p>
                </div>
              </button>
            </div>

            {/* Search section */}
            <div className={`${showSuggestions && suggestions.length > 0 ? 'rounded-t-[24px] rounded-b-none' : 'rounded-full'}`}>
              <div className="flex items-center h-[48px] relative">
                <div className="flex-1 relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  </div>
                  {!address && (
                    <div className="absolute left-12 top-1/2 -translate-y-1/2">
                      <span className="text-[16px] text-gray-400">Search </span>
                      <span className="text-[16px] text-gray-400/80">places</span>
                    </div>
                  )}
                  <Input
                    type="text"
                    placeholder=""
                    value={address}
                    onChange={handleAddressChange}
                    onClick={handleSearchClick}
                    onFocus={handleSearchClick}
                    className={`w-full pl-12 ${address ? 'pr-24' : 'pr-16'} h-[48px] text-[16px] border-0 focus:ring-0 focus-visible:ring-0 bg-transparent text-gray-900 ${
                      showSuggestions && suggestions.length > 0 ? 'rounded-t-[24px] rounded-b-none' : 'rounded-full'
                    }`}
                    disabled={isLoading}
                  />
                </div>
                <div className="px-2 flex gap-2 items-center">
                  {address && (
                    <button
                      onClick={() => {
                        setAddress('')
                        setSuggestions([])
                        setShowSuggestions(false)
                      }}
                      className="w-[24px] h-[24px] flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors duration-150"
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                  <Button 
                    onClick={() => handleSearch()}
                    disabled={isLoading}
                    className="rounded-full bg-blue-600 hover:bg-blue-700 text-white w-[40px] h-[40px] p-0 flex items-center justify-center text-sm font-medium shadow-sm"
                  >
                    Go
                  </Button>
                </div>
              </div>
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="bg-white overflow-hidden max-h-[calc(100vh-120px)] overflow-y-auto rounded-b-[24px]">
                {suggestions.map((suggestion: PlaceSearchResult, index) => (
                  <button
                    key={suggestion.place_id}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-100 flex items-start gap-3 transition-colors duration-150 cursor-pointer group
                      ${index === suggestions.length - 1 ? 'rounded-b-[24px]' : ''}`}
                    onClick={() => handleSuggestionClick(suggestion.place_id, suggestion.description)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <div className="mt-1">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        className={`text-gray-600 group-hover:text-gray-900 transition-colors duration-150`}
                      >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        {suggestion.hasStreetView && (
                          <path d="M12 7v6 M12 15h.01" className="text-gray-900"/>
                        )}
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-gray-900 group-hover:text-gray-900 truncate transition-colors duration-150">
                        {suggestion.description}
                      </p>
                      {suggestion.hasStreetView && (
                        <p className="text-xs text-gray-600">Street View available</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Error Card */}
          {error && (
            <div className="mt-2">
              <Card className="p-3 shadow-lg rounded-xl bg-white/95 backdrop-blur-sm">
                <p className="text-red-600 text-sm">{error}</p>
              </Card>
            </div>
          )}

          {/* Rate limit exceeded message */}
          {rateLimitExceeded && (
            <div className="mt-2">
              <Card className="p-3 shadow-lg rounded-xl bg-yellow-50/95 backdrop-blur-sm">
                <p className="text-yellow-800 text-sm">
                  Too many requests. Please wait a moment before searching again...
                </p>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Click away listener */}
      {showSuggestions && (
        <div 
          className="fixed inset-0 z-30 bg-transparent" 
          onClick={() => setShowSuggestions(false)}
        />
      )}

      {/* Nearby places with backdrop blur */}
      {showNearbyPlaces && (
        <div className="fixed inset-0 z-50 backdrop-blur-sm bg-gray-100/50 flex items-center justify-center">
          <NearbyPlaces 
            places={nearbyPlaces}
            onPlaceSelect={async (location) => {
              setShowNearbyPlaces(false)
              await initializeStreetView(location)
            }}
          />
        </div>
      )}
    </>
  )
} 