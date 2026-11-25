import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { DEFAULT_CITY } from '../utils/aqi';
import { fetchLiveAirQuality } from '../services/airQualityService';
import {
  subscribeFavorites,
  addFavoriteLocation,
  removeFavoriteLocation,
} from '../services/firestoreService';
import { useAuth } from './AuthContext';

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const { user, userProfile, updateUserProfile } = useAuth();
  const [selectedCity, setSelectedCity] = useState(DEFAULT_CITY);
  const [aqiStandard, setAqiStandard] = useState('US'); // 'US' | 'IN'
  const [currentReading, setCurrentReading] = useState(null);
  const [loadingReading, setLoadingReading] = useState(true);
  const [favorites, setFavorites] = useState([]);

  // Sync preferred city & standard from userProfile on login
  useEffect(() => {
    if (userProfile?.preferredCity?.name) {
      setSelectedCity(userProfile.preferredCity);
    }
    if (userProfile?.preferredStandard === 'IN' || userProfile?.preferredStandard === 'US') {
      setAqiStandard(userProfile.preferredStandard);
    }
  }, [userProfile?.preferredCity?.name, userProfile?.preferredStandard]);

  // Subscribe to favoriteLocations in Firestore
  useEffect(() => {
    if (!user?.uid) {
      setFavorites([]);
      return;
    }
    const unsub = subscribeFavorites(user.uid, (list) => setFavorites(list));
    return () => unsub();
  }, [user?.uid]);

  const refreshReading = useCallback(
    async (cityToLoad = selectedCity, forceRefresh = false) => {
      if (!cityToLoad) return;
      setLoadingReading(true);
      try {
        const reading = await fetchLiveAirQuality(cityToLoad, { forceRefresh });
        setCurrentReading(reading);
      } finally {
        setLoadingReading(false);
      }
    },
    [selectedCity]
  );

  useEffect(() => {
    refreshReading(selectedCity, false);
  }, [selectedCity?.lat, selectedCity?.lon]);

  const selectCity = useCallback((city) => {
    setSelectedCity({
      name: city.name,
      state: city.state || '',
      country: city.country || '',
      lat: Number(city.lat),
      lon: Number(city.lon),
    });
  }, []);

  const toggleStandard = useCallback(
    async (nextStandard) => {
      setAqiStandard(nextStandard);
      if (user) {
        try {
          await updateUserProfile({ preferredStandard: nextStandard });
        } catch {
          // Non-blocking
        }
      }
    },
    [user, updateUserProfile]
  );

  const toggleFavorite = useCallback(
    async (city) => {
      if (!user?.uid) throw new Error('Sign in to save favorite cities.');
      const existing = favorites.find(
        (f) =>
          f.locationName.toLowerCase() === city.name.toLowerCase() &&
          Math.abs(f.lat - Number(city.lat)) < 0.05
      );
      if (existing) {
        await removeFavoriteLocation(existing.id);
        return false;
      }
      await addFavoriteLocation(user.uid, city);
      return true;
    },
    [user?.uid, favorites]
  );

  const isFavorite = useCallback(
    (city) => {
      if (!city) return false;
      return favorites.some(
        (f) =>
          f.locationName.toLowerCase() === city.name.toLowerCase() &&
          Math.abs(f.lat - Number(city.lat)) < 0.05
      );
    },
    [favorites]
  );

  return (
    <LocationContext.Provider
      value={{
        selectedCity,
        selectCity,
        aqiStandard,
        setAqiStandard: toggleStandard,
        currentReading,
        loadingReading,
        refreshReading,
        favorites,
        toggleFavorite,
        isFavorite,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationContext must be used inside LocationProvider');
  return ctx;
}
