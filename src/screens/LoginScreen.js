// src/screens/LoginScreen.js
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
import { sendOTP } from "../store/authSlice";

export default function LoginScreen({ navigation }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.auth);

  const handleSendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert("Error", "Please enter a valid phone number");
      return;
    }

    try {
      await dispatch(sendOTP(phoneNumber)).unwrap();
      navigation.navigate("OTP", { phoneNumber });
    } catch (error) {
      Alert.alert("Error", "Failed to send OTP. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Therapist Connect</Text>
      <Text style={styles.subtitle}>Connect with therapists instantly</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter phone number"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          maxLength={15}
        />
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleSendOTP}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send OTP</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.therapistLink}
        onPress={() => navigation.navigate("TherapistLogin")}
      >
        <Text style={styles.linkText}>Are you a therapist? Login here</Text>
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
    fontSize: 32,
    fontWeight: "bold",
    color: "#4A90E2",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 40,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
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
  therapistLink: {
    marginTop: 20,
  },
  linkText: {
    color: "#4A90E2",
    fontSize: 16,
  },
});
