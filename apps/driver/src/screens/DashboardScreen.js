import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useLocation } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import websocketService from '../services/websocket';
import Toast from 'react-native-toast-message';

export default function DashboardScreen({ navigation }) {
  const [isOnline, setIsOnline] = useState(false);
  const [earnings, setEarnings] = useState({ today: 0, week: 0 });
  const [stats, setStats] = useState({ ridesCompleted: 0, rating: 0 });
  const { location, startTracking, stopTracking, getCurrentLocation } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (isOnline) {
      connectWebSocket();
      startTracking();
    } else {
      disconnectWebSocket();
      stopTracking();
    }
  }, [isOnline]);

  useEffect(() => {
    fetchDashboardData();
    getCurrentLocation();
  }, []);

  useEffect(() => {
    // Listen for ride requests
    websocketService.on('ride_request', handleRideRequest);

    return () => {
      websocketService.off('ride_request', handleRideRequest);
    };
  }, []);

  const connectWebSocket = async () => {
    try {
      await websocketService.connect();
      websocketService.goOnline();
      Toast.show({
        type: 'success',
        text1: 'You are now online',
        text2: 'Ready to accept ride requests',
      });
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setIsOnline(false);
    }
  };

  const disconnectWebSocket = () => {
    websocketService.goOffline();
    websocketService.disconnect();
  };

  const fetchDashboardData = async () => {
    // Fetch earnings and stats from API
    try {
      // Implementation would call API
      setEarnings({ today: 125.50, week: 892.30 });
      setStats({ ridesCompleted: 12, rating: 4.8 });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const handleRideRequest = (rideData) => {
    Alert.alert(
      'New Ride Request',
      `Pickup: ${rideData.pickupAddress}`,
      [
        {
          text: 'Reject',
          style: 'cancel',
          onPress: () => rejectRide(rideData.rideId),
        },
        {
          text: 'View Details',
          onPress: () => navigation.navigate('RideRequest', { ride: rideData }),
        },
      ]
    );
  };

  const rejectRide = (rideId) => {
    websocketService.rejectRide(rideId);
  };

  const toggleOnlineStatus = () => {
    if (!isOnline && user?.status !== 'verified') {
      Alert.alert(
        'Account Not Verified',
        'Your account needs to be verified before you can go online. Please contact support.',
        [{ text: 'OK' }]
      );
      return;
    }
    setIsOnline(!isOnline);
  };

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {location && (
          <Marker
            coordinate={location}
            title="Your Location"
            pinColor={isOnline ? 'green' : 'gray'}
          />
        )}
      </MapView>

      <View style={styles.overlay}>
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={toggleOnlineStatus}
              trackColor={{ false: '#767577', true: '#4CAF50' }}
              thumbColor={isOnline ? '#fff' : '#f4f3f4'}
            />
          </View>

          {isOnline && (
            <Text style={styles.statusSubtext}>
              Accepting ride requests
            </Text>
          )}
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Icon name="attach-money" size={24} color="#4CAF50" />
              <Text style={styles.statValue}>${earnings.today.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Today</Text>
            </View>

            <View style={styles.statItem}>
              <Icon name="directions-car" size={24} color="#2196F3" />
              <Text style={styles.statValue}>{stats.ridesCompleted}</Text>
              <Text style={styles.statLabel}>Rides</Text>
            </View>

            <View style={styles.statItem}>
              <Icon name="star" size={24} color="#FFC107" />
              <Text style={styles.statValue}>{stats.rating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.earningsButton}
            onPress={() => navigation.navigate('Earnings')}
          >
            <Text style={styles.earningsButtonText}>
              Weekly Earnings: ${earnings.week.toFixed(2)}
            </Text>
            <Icon name="chevron-right" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
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
  overlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
  },
  statusCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 15,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statusSubtext: {
    marginTop: 5,
    fontSize: 14,
    color: '#4CAF50',
  },
  statsCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  earningsButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
