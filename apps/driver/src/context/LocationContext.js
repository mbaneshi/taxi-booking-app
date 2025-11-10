import React, { createContext, useState, useEffect, useContext } from 'react';
import Geolocation from 'react-native-geolocation-service';
import { Platform, PermissionsAndroid } from 'react-native';
import BackgroundGeolocation from 'react-native-background-geolocation';
import websocketService from '../services/websocket';
import { useAuth } from './AuthContext';

const LocationContext = createContext({});

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    requestLocationPermission();
    return () => {
      stopTracking();
    };
  }, []);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'This app needs access to your location for driver tracking',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      setPermissionGranted(granted === PermissionsAndroid.RESULTS.GRANTED);
    } else {
      setPermissionGranted(true);
    }
  };

  const startTracking = async () => {
    if (!permissionGranted) {
      await requestLocationPermission();
      return;
    }

    try {
      // Configure background geolocation
      await BackgroundGeolocation.ready({
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
        distanceFilter: 10,
        stopTimeout: 5,
        debug: false,
        logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
        stopOnTerminate: false,
        startOnBoot: true,
        locationUpdateInterval: 5000,
        fastestLocationUpdateInterval: 3000,
      });

      // Start tracking
      BackgroundGeolocation.start();

      // Listen for location updates
      BackgroundGeolocation.onLocation(
        (location) => {
          const locationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading,
            speed: location.coords.speed,
          };

          setLocation(locationData);

          // Send to server via WebSocket
          if (user && websocketService.isConnected()) {
            websocketService.updateLocation(locationData);
          }
        },
        (error) => {
          console.error('Location error:', error);
        }
      );

      setTracking(true);
    } catch (error) {
      console.error('Error starting tracking:', error);
    }
  };

  const stopTracking = async () => {
    try {
      await BackgroundGeolocation.stop();
      setTracking(false);
    } catch (error) {
      console.error('Error stopping tracking:', error);
    }
  };

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocation(locationData);
          resolve(locationData);
        },
        (error) => {
          console.error('Get current location error:', error);
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  };

  return (
    <LocationContext.Provider
      value={{
        location,
        tracking,
        permissionGranted,
        startTracking,
        stopTracking,
        getCurrentLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => useContext(LocationContext);
