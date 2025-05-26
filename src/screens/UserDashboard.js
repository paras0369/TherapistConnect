// src/screens/UserDashboard.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../store/authSlice";
import api from "../services/api";
import socketService from "../services/socket";

export default function UserDashboard({ navigation }) {
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  useEffect(() => {
    fetchTherapists();

    // Connect socket
    const socket = socketService.connect();
    socketService.emit("user-connect", user.id);
    console.log("User connected to socket with ID:", user.id);

    // Listen for call events
    socketService.on("call-accepted", (data) => {
      console.log("Call accepted, navigating to call screen:", data);
      setCalling(false);

      navigation.navigate("Call", {
        roomId: data.roomId,
        therapistId: data.therapistId,
        isInitiator: true, // User is always the initiator
      });
    });

    socketService.on("call-rejected", () => {
      console.log("Call rejected by therapist");
      setCalling(false);
      Alert.alert("Call Rejected", "The therapist is not available");
    });

    return () => {
      socketService.off("call-accepted");
      socketService.off("call-rejected");
      socketService.disconnect();
    };
  }, []);

  const fetchTherapists = async () => {
    try {
      const response = await api.get("/user/therapists");
      console.log("Fetched therapists:", response.data.therapists);
      setTherapists(response.data.therapists);
    } catch (error) {
      console.error("Error fetching therapists:", error);
      Alert.alert("Error", "Failed to fetch therapists");
    } finally {
      setLoading(false);
    }
  };

  const initiateCall = async (therapist) => {
    if (calling) {
      console.log("Already calling, ignoring request");
      return;
    }

    if (user.coinBalance < 5) {
      Alert.alert(
        "Insufficient Balance",
        "You need at least 5 coins to make a call"
      );
      return;
    }

    try {
      setCalling(true);
      console.log("Initiating call to therapist:", therapist._id);

      const response = await api.post("/call/initiate", {
        therapistId: therapist._id,
      });

      console.log("Call initiated, room ID:", response.data.roomId);

      // Emit call request to therapist
      socketService.emit("call-therapist", {
        therapistId: therapist._id,
        userId: user.id,
        userName: user.name || "User",
        roomId: response.data.roomId,
      });

      console.log("Call request sent to therapist");
      Alert.alert("Calling...", "Waiting for therapist to accept", [
        {
          text: "Cancel",
          onPress: () => {
            setCalling(false);
            // You might want to emit a cancel call event here
          },
        },
      ]);
    } catch (error) {
      console.error("Error initiating call:", error);
      setCalling(false);
      Alert.alert("Error", "Failed to initiate call");
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  const renderTherapist = ({ item }) => (
    <View style={styles.therapistCard}>
      <View style={styles.therapistInfo}>
        <Text style={styles.therapistName}>{item.name}</Text>
        <Text style={styles.therapistStatus}>Available</Text>
      </View>
      <TouchableOpacity
        style={[styles.callButton, calling && styles.disabledButton]}
        onPress={() => initiateCall(item)}
        disabled={calling}
      >
        {calling ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.callButtonText}>Call</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.coinBalance}>Coins: {user?.coinBalance || 0}</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={therapists}
          renderItem={renderTherapist}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No therapists available</Text>
          }
        />
      )}
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
  coinBalance: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  logoutText: {
    color: "#4A90E2",
    fontSize: 16,
  },
  loader: {
    marginTop: 50,
  },
  listContainer: {
    padding: 15,
  },
  therapistCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  therapistInfo: {
    flex: 1,
  },
  therapistName: {
    fontSize: 18,
    color: "#333",
    fontWeight: "500",
  },
  therapistStatus: {
    fontSize: 14,
    color: "#4CAF50",
    marginTop: 2,
  },
  callButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    minWidth: 80,
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  callButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 16,
    color: "#666",
    marginTop: 50,
  },
});
