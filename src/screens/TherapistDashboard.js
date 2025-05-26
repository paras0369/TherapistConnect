// src/screens/TherapistDashboard.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../store/authSlice";
import api from "../services/api";
import socketService from "../services/socket";

export default function TherapistDashboard({ navigation }) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const { therapist } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  useEffect(() => {
    if (therapist) {
      setIsAvailable(therapist.isAvailable);

      // Connect socket
      const socket = socketService.connect();
      socketService.emit("therapist-connect", therapist.id);

      // Listen for incoming calls
      socketService.on("incoming-call", (data) => {
        setIncomingCall(data);
        setShowCallModal(true);
      });
    }

    return () => {
      socketService.disconnect();
    };
  }, [therapist]);

  const toggleAvailability = async () => {
    try {
      const response = await api.put("/therapist/availability", {
        isAvailable: !isAvailable,
      });
      setIsAvailable(response.data.therapist.isAvailable);
    } catch (error) {
      Alert.alert("Error", "Failed to update availability");
    }
  };

  const acceptCall = async () => {
    setShowCallModal(false);

    try {
      await api.post(`/call/answer/${incomingCall.roomId.split("-")[1]}`);

      socketService.emit("call-accepted", {
        userId: incomingCall.userId,
        therapistId: therapist.id,
        roomId: incomingCall.roomId,
      });

      navigation.navigate("Call", {
        roomId: incomingCall.roomId,
        userId: incomingCall.userId,
        isInitiator: false,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to accept call");
    }
  };

  const rejectCall = () => {
    setShowCallModal(false);
    socketService.emit("call-rejected", {
      userId: incomingCall.userId,
    });
    setIncomingCall(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.earnings}>
          Earnings: {therapist?.totalEarningsCoins || 0} coins
        </Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.availabilityContainer}>
          <Text style={styles.availabilityText}>
            Status: {isAvailable ? "Available" : "Unavailable"}
          </Text>
          <Switch
            value={isAvailable}
            onValueChange={toggleAvailability}
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={isAvailable ? "#4A90E2" : "#f4f3f4"}
          />
        </View>

        <Text style={styles.infoText}>
          {isAvailable
            ? "You are visible to users and can receive calls"
            : "You are not visible to users"}
        </Text>
      </View>

      <Modal visible={showCallModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Incoming Call</Text>
            <Text style={styles.modalText}>
              {incomingCall?.userName || "User"} is calling...
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.rejectButton]}
                onPress={rejectCall}
              >
                <Text style={styles.modalButtonText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.acceptButton]}
                onPress={acceptCall}
              >
                <Text style={styles.modalButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  earnings: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  logoutText: {
    color: "#4A90E2",
    fontSize: 16,
  },
  content: {
    padding: 20,
  },
  availabilityContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  availabilityText: {
    fontSize: 18,
    color: "#333",
  },
  infoText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 10,
    width: "80%",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalText: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  modalButton: {
    padding: 15,
    borderRadius: 5,
    minWidth: 100,
    alignItems: "center",
  },
  rejectButton: {
    backgroundColor: "#f44336",
  },
  acceptButton: {
    backgroundColor: "#4CAF50",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
