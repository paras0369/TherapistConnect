// src/screens/OTPScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { verifyOTP } from "../store/authSlice";

export default function OTPScreen({ route, navigation }) {
  const { phoneNumber } = route.params;
  const [otp, setOtp] = useState("");
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.auth);

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert("Error", "Please enter a valid 6-digit OTP");
      return;
    }

    try {
      await dispatch(verifyOTP({ phoneNumber, otp })).unwrap();
      navigation.reset({
        index: 0,
        routes: [{ name: "UserDashboard" }],
      });
    } catch (error) {
      Alert.alert("Error", "Invalid OTP. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter OTP</Text>
      <Text style={styles.subtitle}>
        We've sent a 6-digit code to {phoneNumber}
      </Text>

      <TextInput
        style={styles.otpInput}
        placeholder="000000"
        keyboardType="numeric"
        value={otp}
        onChangeText={setOtp}
        maxLength={6}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleVerifyOTP}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify OTP</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 40,
    textAlign: "center",
  },
  otpInput: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    fontSize: 24,
    letterSpacing: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    width: 200,
    textAlign: "center",
    marginBottom: 30,
  },
  button: {
    backgroundColor: "#4A90E2",
    padding: 15,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
