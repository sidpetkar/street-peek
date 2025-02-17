import { } from '@types/google.maps';

declare global {
  interface Window {
    google: typeof google;
    initMap: () => void;
  }
}

export {}; 