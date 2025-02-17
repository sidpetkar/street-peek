declare global {
  interface Window {
    google: {
      maps: {
        importLibrary: (library: string) => Promise<any>;
        StreetViewPanorama: any;
        StreetViewService: any;
        Geocoder: any;
        places: {
          AutocompleteService: any;
          AutocompleteSessionToken: any;
          PlacesService: any;
          PlacesServiceStatus: {
            OK: string;
            ZERO_RESULTS: string;
            INVALID_REQUEST: string;
          };
          RankBy: {
            DISTANCE: number;
            RATING: number;
          };
          PlaceResult: any;
          PhotoOptions: any;
        };
        DirectionsService: any;
        TravelMode: any;
        LatLng: any;
        geometry: {
          spherical: {
            computeDistanceBetween: (from: any, to: any) => number;
          };
        };
      };
    };
    initMap: () => void;
  }
}

export interface EnhancedPlaceResult extends google.maps.places.PlaceResult {
  description?: string;
  hasStreetView?: boolean;
  streetViewLocation?: google.maps.LatLng;
  details?: google.maps.places.PlaceResult;
  score?: number;
}

export interface PlaceSearchResult {
  description: string;
  place_id: string;
  hasStreetView?: boolean;
  streetViewLocation?: google.maps.LatLng;
  details?: google.maps.places.PlaceResult;
  score?: number;
  predictions?: Array<{
    place_id: string;
    description: string;
  }>;
}

export interface NearbyPlace {
  name: string;
  description: string;
  location: {
    lat: number;
    lng: number;
  };
  distance?: string;
  photos?: google.maps.places.PlacePhoto[];
  rating?: number;
  totalRatings?: number;
  openNow?: boolean;
}

export {} 