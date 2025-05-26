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
  StatusBar,
  Dimensions,
  Modal,
  ScrollView,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../store/authSlice";
import api from "../services/api";
import socketService from "../services/socket";
import LinearGradient from "react-native-linear-gradient";

const { width } = Dimensions.get("window");

export default function UserDashboard({ navigation }) {
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [activeTab, setActiveTab] = useState("therapists");
  const [callHistory, setCallHistory] = useState([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  useEffect(() => {
    fetchTherapists();
    fetchCallHistory();

    // Connect socket
    const socket = socketService.connect();
    socketService.emit("user-connect", user.id);

    // Listen for call events
    socketService.on("call-accepted", (data) => {
      setCalling(false);
      navigation.navigate("Call", {
        roomId: data.roomId,
        therapistId: data.therapistId,
        isInitiator: true,
      });
    });

    socketService.on("call-rejected", () => {
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
      setTherapists(response.data.therapists);
    } catch (error) {
      Alert.alert("Error", "Failed to fetch therapists");
    } finally {
      setLoading(false);
    }
  };

  const fetchCallHistory = async () => {
    try {
      const response = await api.get("/user/call-history");
      setCallHistory(response.data.calls || []);
    } catch (error) {
      console.error("Error fetching call history:", error);
    }
  };

  const initiateCall = async (therapist) => {
    if (calling) return;

    if (user.coinBalance < 5) {
      Alert.alert(
        "Insufficient Balance",
        "You need at least 5 coins to make a call"
      );
      return;
    }

    try {
      setCalling(true);
      const response = await api.post("/call/initiate", {
        therapistId: therapist._id,
      });

      console.log("Call initiated, room ID:", response.data.roomId);

      // Join the room first
      socketService.emit("join-room", response.data.roomId);

      // Then emit call request to therapist
      socketService.emit("call-therapist", {
        therapistId: therapist._id,
        userId: user.id,
        userName: user.name || "User",
        roomId: response.data.roomId,
      });

      Alert.alert("Calling...", "Waiting for therapist to accept", [
        {
          text: "Cancel",
          onPress: () => setCalling(false),
        },
      ]);
    } catch (error) {
      setCalling(false);
      Alert.alert("Error", "Failed to initiate call");
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          dispatch(logout());
          navigation.reset({
            index: 0,
            routes: [{ name: "Login" }],
          });
        },
      },
    ]);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  const formatDuration = (minutes) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const renderTherapist = ({ item }) => (
    <View style={styles.therapistCard}>
      <View style={styles.therapistAvatar}>
        <Text style={styles.therapistAvatarText}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.therapistInfo}>
        <Text style={styles.therapistName}>{item.name}</Text>
        <View style={styles.statusContainer}>
          <View style={styles.statusDot} />
          <Text style={styles.therapistStatus}>Available</Text>
        </View>
        <Text style={styles.therapistMeta}>💰 5 coins/min</Text>
      </View>
      <TouchableOpacity
        style={[styles.callButton, calling && styles.disabledButton]}
        onPress={() => initiateCall(item)}
        disabled={calling}
      >
        <LinearGradient
          colors={calling ? ["#ccc", "#ccc"] : ["#4CAF50", "#45a049"]}
          style={styles.callButtonGradient}
        >
          {calling ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.callButtonIcon}>📞</Text>
              <Text style={styles.callButtonText}>Call</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderCallHistoryItem = ({ item }) => (
    <View style={styles.historyCard}>
      <View style={styles.historyHeader}>
        <View style={styles.historyAvatar}>
          <Text style={styles.historyAvatarText}>
            {item.therapistId?.name?.charAt(0) || "T"}
          </Text>
        </View>
        <View style={styles.historyInfo}>
          <Text style={styles.historyTherapistName}>
            {item.therapistId?.name || "Unknown Therapist"}
          </Text>
          <Text style={styles.historyDate}>{formatDate(item.startTime)}</Text>
        </View>
        <View style={styles.historyMeta}>
          <Text style={styles.historyDuration}>
            {formatDuration(item.durationMinutes)}
          </Text>
          <Text style={styles.historyCost}>-{item.costInCoins} coins</Text>
        </View>
      </View>
      <View style={styles.historyStatus}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>
    </View>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case "ended_by_user":
      case "ended_by_therapist":
        return "#4CAF50";
      case "missed":
        return "#f44336";
      case "rejected":
        return "#ff9800";
      default:
        return "#9e9e9e";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "ended_by_user":
        return "Completed";
      case "ended_by_therapist":
        return "Completed";
      case "missed":
        return "Missed";
      case "rejected":
        return "Rejected";
      default:
        return "Unknown";
    }
  };

  const ProfileModal = () => (
    <Modal
      visible={showProfileModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowProfileModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Profile</Text>
          <View style={styles.profileInfo}>
            <Text style={styles.profileLabel}>Phone Number</Text>
            <Text style={styles.profileValue}>{user?.phoneNumber}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileLabel}>Coin Balance</Text>
            <Text style={styles.profileValue}>{user?.coinBalance} coins</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileLabel}>Total Calls</Text>
            <Text style={styles.profileValue}>{callHistory.length}</Text>
          </View>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowProfileModal(false)}
          >
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />

      {/* Header */}
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => setShowProfileModal(true)}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {user?.phoneNumber?.slice(-2) || "U"}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.welcomeText}>Welcome back!</Text>
            <View style={styles.coinContainer}>
              <Text style={styles.coinIcon}>💰</Text>
              <Text style={styles.coinBalance}>
                {user?.coinBalance || 0} coins
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutIcon}>🚪</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "therapists" && styles.activeTab]}
          onPress={() => setActiveTab("therapists")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "therapists" && styles.activeTabText,
            ]}
          >
            👨‍⚕️ Therapists
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "history" && styles.activeTab]}
          onPress={() => setActiveTab("history")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "history" && styles.activeTabText,
            ]}
          >
            📋 Call History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === "therapists" ? (
          loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#667eea" />
              <Text style={styles.loaderText}>Loading therapists...</Text>
            </View>
          ) : (
            <FlatList
              data={therapists}
              renderItem={renderTherapist}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>😔</Text>
                  <Text style={styles.emptyText}>No therapists available</Text>
                  <Text style={styles.emptySubtext}>
                    Please check back later
                  </Text>
                </View>
              }
            />
          )
        ) : (
          <FlatList
            data={callHistory}
            renderItem={renderCallHistoryItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📞</Text>
                <Text style={styles.emptyText}>No call history</Text>
                <Text style={styles.emptySubtext}>
                  Start your first session
                </Text>
              </View>
            }
          />
        )}
      </View>

      <ProfileModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    paddingTop: StatusBar.currentHeight + 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  userAvatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerInfo: {
    flex: 1,
    marginLeft: 15,
  },
  welcomeText: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 4,
  },
  coinContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  coinIcon: {
    fontSize: 16,
    marginRight: 5,
  },
  coinBalance: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  logoutButton: {
    padding: 10,
  },
  logoutIcon: {
    fontSize: 20,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: -10,
    borderRadius: 15,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
    borderRadius: 15,
  },
  activeTab: {
    backgroundColor: "#667eea",
  },
  tabText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  activeTabText: {
    color: "#fff",
  },
  content: {
    flex: 1,
    marginTop: 20,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    marginTop: 10,
    color: "#666",
    fontSize: 16,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  therapistCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  therapistAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  therapistAvatarText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  therapistInfo: {
    flex: 1,
  },
  therapistName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
    marginRight: 6,
  },
  therapistStatus: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "500",
  },
  therapistMeta: {
    fontSize: 12,
    color: "#666",
  },
  callButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  callButtonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  disabledButton: {
    opacity: 0.6,
  },
  callButtonIcon: {
    fontSize: 16,
    marginRight: 5,
  },
  callButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  historyCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  historyAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  historyAvatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  historyInfo: {
    flex: 1,
  },
  historyTherapistName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    color: "#666",
  },
  historyMeta: {
    alignItems: "flex-end",
  },
  historyDuration: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  historyCost: {
    fontSize: 12,
    color: "#f44336",
    fontWeight: "500",
  },
  historyStatus: {
    alignItems: "flex-start",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#666",
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
    borderRadius: 20,
    width: width * 0.8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  profileInfo: {
    marginBottom: 15,
  },
  profileLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
  },
  profileValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  modalCloseButton: {
    backgroundColor: "#667eea",
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 20,
  },
  modalCloseText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
});
