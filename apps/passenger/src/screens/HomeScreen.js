import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import api from '../services/api';
import Toast from 'react-native-toast-message';

export default function HomeScreen({ navigation }) {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [fareEstimate, setFareEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [vehicleType, setVehicleType] = useState('economy');

  const mapRef = useRef(null);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ latitude, longitude });
        setPickupLocation({ latitude, longitude });
      },
      (error) => {
        console.error('Location error:', error);
        Toast.show({
          type: 'error',
          text1: 'Location Error',
          text2: 'Could not get your location'
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const handleDestinationSelect = async (details) => {
    const { lat, lng } = details.geometry.location;
    setDropoffLocation({
      latitude: lat,
      longitude: lng,
      address: details.formatted_address
    });

    // Calculate fare estimate
    if (pickupLocation) {
      await getFareEstimate({
        pickupLatitude: pickupLocation.latitude,
        pickupLongitude: pickupLocation.longitude,
        dropoffLatitude: lat,
        dropoffLongitude: lng
      });
    }

    setShowDestinationModal(false);
  };

  const getFareEstimate = async (locations) => {
    try {
      const response = await api.post('/rides/estimate', {
        ...locations,
        vehicleType
      });
      setFareEstimate(response.data);
    } catch (error) {
      console.error('Fare estimate error:', error);
    }
  };

  const handleBookRide = async () => {
    if (!pickupLocation || !dropoffLocation) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select pickup and dropoff locations'
      });
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/rides', {
        pickupLatitude: pickupLocation.latitude,
        pickupLongitude: pickupLocation.longitude,
        pickupAddress: pickupLocation.address || 'Current Location',
        dropoffLatitude: dropoffLocation.latitude,
        dropoffLongitude: dropoffLocation.longitude,
        dropoffAddress: dropoffLocation.address,
        vehicleType,
        paymentMethod: 'card'
      });

      const ride = response.data;

      Toast.show({
        type: 'success',
        text1: 'Ride Requested',
        text2: 'Finding a driver...'
      });

      navigation.navigate('Ride', { rideId: ride.id });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Booking Failed',
        text2: error.response?.data?.error || 'Please try again'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!currentLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {pickupLocation && (
          <Marker
            coordinate={pickupLocation}
            title="Pickup Location"
            pinColor="green"
          />
        )}

        {dropoffLocation && (
          <Marker
            coordinate={dropoffLocation}
            title="Dropoff Location"
            pinColor="red"
          />
        )}
      </MapView>

      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.destinationButton}
          onPress={() => setShowDestinationModal(true)}
        >
          <Text style={styles.destinationButtonText}>
            {dropoffLocation ? dropoffLocation.address : 'Where to?'}
          </Text>
        </TouchableOpacity>

        {fareEstimate && (
          <View style={styles.fareCard}>
            <Text style={styles.fareTitle}>Estimated Fare</Text>
            <Text style={styles.fareAmount}>CAD ${fareEstimate.total.toFixed(2)}</Text>
            <Text style={styles.fareDetails}>
              Distance: {fareEstimate.estimatedDistance.toFixed(1)} km •
              Time: {fareEstimate.estimatedDuration} min
            </Text>

            <View style={styles.vehicleTypes}>
              {['economy', 'premium', 'suv'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.vehicleButton,
                    vehicleType === type && styles.vehicleButtonActive
                  ]}
                  onPress={() => setVehicleType(type)}
                >
                  <Text
                    style={[
                      styles.vehicleButtonText,
                      vehicleType === type && styles.vehicleButtonTextActive
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.bookButton}
              onPress={handleBookRide}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.bookButtonText}>Request Ride</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal
        visible={showDestinationModal}
        animationType="slide"
        onRequestClose={() => setShowDestinationModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Where to?</Text>
            <TouchableOpacity onPress={() => setShowDestinationModal(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>

          <GooglePlacesAutocomplete
            placeholder="Enter destination"
            onPress={(data, details = null) => {
              handleDestinationSelect(details);
            }}
            query={{
              key: 'YOUR_GOOGLE_MAPS_API_KEY',
              language: 'en',
            }}
            fetchDetails={true}
            styles={{
              container: { flex: 0 },
              textInput: styles.searchInput,
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  overlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
  },
  destinationButton: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  destinationButtonText: {
    fontSize: 16,
    color: '#333',
  },
  fareCard: {
    backgroundColor: '#fff',
    marginTop: 20,
    padding: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fareTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  fareAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 5,
  },
  fareDetails: {
    fontSize: 14,
    color: '#999',
    marginBottom: 15,
  },
  vehicleTypes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  vehicleButton: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  vehicleButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  vehicleButtonText: {
    color: '#666',
  },
  vehicleButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  bookButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalClose: {
    fontSize: 16,
    color: '#2196F3',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    margin: 20,
  },
});
