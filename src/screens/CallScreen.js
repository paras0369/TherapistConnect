// src/screens/CallScreen.js
import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from "react-native-webrtc";
import InCallManager from "react-native-incall-manager";
import api from "../services/api";
import socketService from "../services/socket";

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function CallScreen({ route, navigation }) {
  const { roomId, isInitiator } = route.params;
  const [callDuration, setCallDuration] = useState(0);
  const [localStream, setLocalStream] = useState(null);
  const peerConnection = useRef(null);
  const callTimer = useRef(null);

  useEffect(() => {
    setupCall();

    return () => {
      endCall();
    };
  }, []);

  useEffect(() => {
    // Update call duration every second
    callTimer.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      if (callTimer.current) {
        clearInterval(callTimer.current);
      }
    };
  }, []);

  const setupCall = async () => {
    try {
      // Start InCallManager
      InCallManager.start({ media: "audio" });
      InCallManager.setKeepScreenOn(true);

      // Get user media
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      setLocalStream(stream);

      // Create peer connection
      peerConnection.current = new RTCPeerConnection(configuration);

      // Add local stream
      stream.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, stream);
      });

      // Handle ICE candidates
      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socketService.emit("ice-candidate", {
            roomId,
            candidate: event.candidate,
          });
        }
      };

      // Listen for remote ICE candidates
      socketService.on("ice-candidate", async (data) => {
        try {
          await peerConnection.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      });

      // Create and handle offers/answers
      if (isInitiator) {
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socketService.emit("offer", { roomId, offer });

        socketService.on("answer", async (data) => {
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        });
      } else {
        socketService.on("offer", async (data) => {
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(data.offer)
          );
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          socketService.emit("answer", { roomId, answer });
        });
      }
    } catch (error) {
      console.error("Error setting up call:", error);
      Alert.alert("Error", "Failed to setup call");
      navigation.goBack();
    }
  };

  const endCall = async () => {
    try {
      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }

      // Close peer connection
      if (peerConnection.current) {
        peerConnection.current.close();
      }

      // Stop InCallManager
      InCallManager.stop();

      // Clear timer
      if (callTimer.current) {
        clearInterval(callTimer.current);
      }

      // End call on server
      const callId = roomId.split("-")[1];
      await api.post(`/call/end/${callId}`, {
        endedBy: isInitiator ? "user" : "therapist",
      });

      navigation.goBack();
    } catch (error) {
      console.error("Error ending call:", error);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.callInfo}>
        <Text style={styles.callStatus}>In Call</Text>
        <Text style={styles.duration}>{formatDuration(callDuration)}</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.endCallButton} onPress={endCall}>
          <Text style={styles.endCallText}>End Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    justifyContent: "space-between",
  },
  callInfo: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  callStatus: {
    fontSize: 24,
    color: "#fff",
    marginBottom: 20,
  },
  duration: {
    fontSize: 48,
    color: "#fff",
    fontWeight: "bold",
  },
  controls: {
    padding: 30,
    alignItems: "center",
  },
  endCallButton: {
    backgroundColor: "#f44336",
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  endCallText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
});
