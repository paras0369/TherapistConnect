// App.js
import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { Provider } from "react-redux";
import { store } from "./src/store";
import AsyncStorage from "@react-native-async-storage/async-storage";

import LoginScreen from "./src/screens/LoginScreen";
import OTPScreen from "./src/screens/OTPScreen";
import UserDashboard from "./src/screens/UserDashboard";
import TherapistDashboard from "./src/screens/TherapistDashboard";
import CallScreen from "./src/screens/CallScreen";
import TherapistLoginScreen from "./src/screens/TherapistLoginScreen";

const Stack = createStackNavigator();

export default function App() {
  return (
    <Provider store={store}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
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
    </Provider>
  );
}
