import React from 'react';
import Image from 'next/image';

interface Place {
  name: string;
  description: string;
  location: { lat: number; lng: number };
  distance?: string;
  photos?: google.maps.places.PlacePhoto[];
  rating?: number;
  totalRatings?: number;
  openNow?: boolean;
}

interface NearbyPlacesProps {
  places: Place[];
  onPlaceSelect: (location: { lat: number; lng: number }) => void;
}

export function NearbyPlaces({ places, onPlaceSelect }: NearbyPlacesProps) {
  return (
    <div className="max-w-4xl w-full mx-4 p-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">No Street View found at this location</h2>
        <p className="text-gray-200">Explore these nearby places instead:</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {places.map((place) => (
          <button
            key={place.name}
            onClick={() => onPlaceSelect(place.location)}
            className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200 group text-left"
          >
            <div className="aspect-video bg-gray-100 relative overflow-hidden">
              {place.photos && place.photos.length > 0 ? (
                <Image 
                  src={place.photos[0].getUrl({ maxWidth: 400, maxHeight: 300 })}
                  alt={place.name}
                  width={400}
                  height={300}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-50">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
              )}
              <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded-full text-xs">
                {place.distance}
              </div>
              {place.openNow !== undefined && (
                <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs ${place.openNow ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                  {place.openNow ? 'Open' : 'Closed'}
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors duration-200 line-clamp-1">
                {place.name}
              </h3>
              {place.rating && (
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={`w-4 h-4 ${i < Math.floor(place.rating ?? 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  {place.totalRatings && (
                    <span className="text-xs text-gray-500">({place.totalRatings})</span>
                  )}
                </div>
              )}
              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{place.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
} 