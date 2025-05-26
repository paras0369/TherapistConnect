// App.js
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { Provider } from "react-redux";
import { store } from "./src/store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator, StyleSheet } from "react-native";

import LoginScreen from "./src/screens/LoginScreen";
import OTPScreen from "./src/screens/OTPScreen";
import UserDashboard from "./src/screens/UserDashboard";
import TherapistDashboard from "./src/screens/TherapistDashboard";
import CallScreen from "./src/screens/CallScreen";
import TherapistLoginScreen from "./src/screens/TherapistLoginScreen";

// Import the setAuth action
import { setAuth } from "./src/store/authSlice";
import api from "./src/services/api";

const Stack = createStackNavigator();

function AppContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState("Login");

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      console.log("Checking authentication state...");

      const token = await AsyncStorage.getItem("token");
      const userType = await AsyncStorage.getItem("userType");

      if (token && userType) {
        console.log("Found stored credentials:", { userType });

        // Verify token with server and get user data
        try {
          let response;
          if (userType === "user") {
            response = await api.get("/user/profile");
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
          // Token is invalid, clear storage
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
            title: "Available Therapists",
            headerLeft: null,
          }}
        />
        <Stack.Screen
          name="TherapistDashboard"
          component={TherapistDashboard}
          options={{
            title: "Therapist Dashboard",
            headerLeft: null,
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
