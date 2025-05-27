// Updated App.js - Add Firebase initialization
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { Provider } from "react-redux";
import { store } from "./src/store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Alert,
  AppState,
} from "react-native";
import { FirebaseService } from "./src/services/firebase";

import LoginScreen from "./src/screens/LoginScreen";
import OTPScreen from "./src/screens/OTPScreen";
import UserDashboard from "./src/screens/UserDashboard";
import TherapistDashboard from "./src/screens/TherapistDashboard";
import CallScreen from "./src/screens/CallScreen";
import TherapistLoginScreen from "./src/screens/TherapistLoginScreen";

import { setAuth } from "./src/store/authSlice";
import api from "./src/services/api";

const Stack = createStackNavigator();

function AppContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState("Login");

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize Firebase
      const fcmToken = await FirebaseService.initializeFirebase();
      console.log("FCM Token:", fcmToken);

      // Setup notification listeners
      const unsubscribe = FirebaseService.setupNotificationListeners(
        handleCallNotification
      );

      // Check authentication state
      await checkAuthState(fcmToken);

      // Handle app state changes
      const handleAppStateChange = (nextAppState) => {
        if (nextAppState === "active") {
          console.log("App has come to the foreground");
        }
      };

      AppState.addEventListener("change", handleAppStateChange);

      return () => {
        unsubscribe();
        AppState.removeEventListener("change", handleAppStateChange);
      };
    } catch (error) {
      console.error("App initialization error:", error);
      setIsLoading(false);
    }
  };

  const handleCallNotification = (notificationData) => {
    console.log("Call notification received:", notificationData);

    if (notificationData.type === "incoming_call") {
      Alert.alert(
        "Incoming Call",
        `${notificationData.userName} is calling you`,
        [
          {
            text: "Decline",
            style: "cancel",
            onPress: () => {
              // Handle call decline
              console.log("Call declined");
            },
          },
          {
            text: "Accept",
            onPress: () => {
              // Navigate to call screen
              // You'll need to implement navigation from here
              console.log("Call accepted from notification");
            },
          },
        ]
      );
    }
  };

  const checkAuthState = async (fcmToken) => {
    try {
      console.log("Checking authentication state...");

      const token = await AsyncStorage.getItem("token");
      const userType = await AsyncStorage.getItem("userType");

      if (token && userType) {
        console.log("Found stored credentials:", { userType });

        // Update FCM token on server
        if (fcmToken) {
          try {
            await api.post("/auth/update-fcm-token", {
              fcmToken,
              userType,
              userId: "temp", // Will be updated after profile fetch
            });
          } catch (error) {
            console.log("Failed to update FCM token initially");
          }
        }

        // Verify token with server and get user data
        try {
          let response;
          if (userType === "user") {
            response = await api.get("/user/profile");

            // Update FCM token with correct user ID
            if (fcmToken) {
              await api.post("/auth/update-fcm-token", {
                fcmToken,
                userType: "user",
                userId: response.data.user._id,
              });
            }

            store.dispatch(
              setAuth({
                token,
                userType: "user",
                user: {
                  id: response.data.user._id,
                  phoneNumber: response.data.user.phoneNumber,
                  coinBalance: response.data.user.coinBalance,
                },
              })
            );
            setInitialRoute("UserDashboard");
          } else if (userType === "therapist") {
            response = await api.get("/therapist/profile");

            // Update FCM token with correct therapist ID
            if (fcmToken) {
              await api.post("/auth/update-fcm-token", {
                fcmToken,
                userType: "therapist",
                userId: response.data.therapist._id,
              });
            }

            store.dispatch(
              setAuth({
                token,
                userType: "therapist",
                therapist: {
                  id: response.data.therapist._id,
                  name: response.data.therapist.name,
                  email: response.data.therapist.email,
                  isAvailable: response.data.therapist.isAvailable,
                  totalEarningsCoins:
                    response.data.therapist.totalEarningsCoins,
                },
              })
            );
            setInitialRoute("TherapistDashboard");
          }

          console.log("Auto-login successful for:", userType);
        } catch (error) {
          console.log("Token validation failed, clearing stored data");
          await AsyncStorage.removeItem("token");
          await AsyncStorage.removeItem("userType");
          setInitialRoute("Login");
        }
      } else {
        console.log("No stored credentials found");
        setInitialRoute("Login");
      }
    } catch (error) {
      console.error("Error checking auth state:", error);
      setInitialRoute("Login");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: {
            backgroundColor: "#4A90E2",
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="OTP"
          component={OTPScreen}
          options={{ title: "Verify OTP" }}
        />
        <Stack.Screen
          name="TherapistLogin"
          component={TherapistLoginScreen}
          options={{ title: "Therapist Login" }}
        />
        <Stack.Screen
          name="UserDashboard"
          component={UserDashboard}
          options={{
            title: "TherapyConnect",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="TherapistDashboard"
          component={TherapistDashboard}
          options={{
            title: "Therapist Dashboard",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Call"
          component={CallScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
});
