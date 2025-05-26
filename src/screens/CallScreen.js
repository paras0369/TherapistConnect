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
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export default function CallScreen({ route, navigation }) {
  const { roomId, isInitiator } = route.params;
  const [callDuration, setCallDuration] = useState(0);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState("Initializing...");

  const peerConnection = useRef(null);
  const callTimer = useRef(null);
  const hasSetRemoteDescription = useRef(false);
  const pendingCandidates = useRef([]);
  const isSetupComplete = useRef(false);

  useEffect(() => {
    console.log("CallScreen mounted with params:", { roomId, isInitiator });
    setupCall();

    return () => {
      console.log("CallScreen unmounting, cleaning up...");
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (isConnected && !callTimer.current) {
      console.log("Starting call timer");
      callTimer.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (callTimer.current) {
        clearInterval(callTimer.current);
        callTimer.current = null;
      }
    };
  }, [isConnected]);

  const setupCall = async () => {
    try {
      console.log("Setting up call...");
      setConnectionState("Setting up call...");

      // Join the room first
      console.log("Joining room:", roomId);
      socketService.emit("join-room", roomId);

      // Configure InCallManager for audio routing
      InCallManager.start({ media: "audio", ringback: false });
      InCallManager.setKeepScreenOn(true);
      InCallManager.setSpeakerphoneOn(false);

      console.log("Getting user media...");
      // Get user media with audio only
      const stream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
        video: false,
      });

      console.log("Got local stream:", stream.getTracks().length, "tracks");
      setLocalStream(stream);
      setConnectionState("Media ready, connecting...");

      // Create peer connection
      peerConnection.current = new RTCPeerConnection(configuration);
      console.log("Created peer connection");

      // Add local stream tracks
      stream.getTracks().forEach((track, index) => {
        console.log(`Adding track ${index}:`, track.kind, track.enabled);
        peerConnection.current.addTrack(track, stream);
      });

      // Handle remote stream
      peerConnection.current.ontrack = (event) => {
        console.log("Received remote track:", event.track.kind);
        if (event.streams && event.streams[0]) {
          console.log("Setting remote stream");
          setRemoteStream(event.streams[0]);
          setConnectionState("Audio connected");
        }
      };

      // Handle connection state changes
      peerConnection.current.onconnectionstatechange = () => {
        const state = peerConnection.current.connectionState;
        console.log("Connection state changed to:", state);

        switch (state) {
          case "connected":
            setIsConnected(true);
            setConnectionState("Connected");
            break;
          case "disconnected":
            setConnectionState("Disconnected");
            setIsConnected(false);
            break;
          case "failed":
            setConnectionState("Connection failed");
            console.error("WebRTC connection failed");
            Alert.alert("Connection Error", "Call connection failed");
            break;
          case "connecting":
            setConnectionState("Connecting...");
            break;
          case "new":
            setConnectionState("Initializing...");
            break;
        }
      };

      // Handle ICE connection state
      peerConnection.current.oniceconnectionstatechange = () => {
        const iceState = peerConnection.current.iceConnectionState;
        console.log("ICE connection state:", iceState);

        if (iceState === "connected" || iceState === "completed") {
          setIsConnected(true);
          setConnectionState("Connected");
        } else if (iceState === "failed") {
          console.error("ICE connection failed");
          Alert.alert("Connection Error", "Failed to establish connection");
        }
      };

      // Handle ICE gathering state
      peerConnection.current.onicegatheringstatechange = () => {
        console.log(
          "ICE gathering state:",
          peerConnection.current.iceGatheringState
        );
      };

      // Handle ICE candidates
      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("Sending ICE candidate");
          socketService.emit("ice-candidate", {
            roomId,
            candidate: event.candidate,
          });
        } else {
          console.log("ICE gathering completed");
        }
      };

      // Set up socket listeners
      setupSocketListeners();

      isSetupComplete.current = true;

      // Start the signaling process
      if (isInitiator) {
        console.log("User is initiator, creating offer...");
        setConnectionState("Creating offer...");
        // Small delay to ensure setup is complete
        setTimeout(() => {
          createOffer();
        }, 1000);
      } else {
        console.log("Therapist waiting for offer...");
        setConnectionState("Waiting for offer...");
      }
    } catch (error) {
      console.error("Error setting up call:", error);
      Alert.alert("Error", "Failed to setup call: " + error.message);
      navigation.goBack();
    }
  };

  const setupSocketListeners = () => {
    console.log("Setting up socket listeners for room:", roomId);

    // Remove any existing listeners first
    socketService.off("ice-candidate");
    socketService.off("offer");
    socketService.off("answer");
    socketService.off("call-ended");

    socketService.on("ice-candidate", async (data) => {
      console.log("Received ICE candidate for room:", data.roomId);

      // Only process if it's for our room
      if (data.roomId !== roomId) {
        console.log("ICE candidate not for our room, ignoring");
        return;
      }

      try {
        const candidate = new RTCIceCandidate(data.candidate);

        if (hasSetRemoteDescription.current && peerConnection.current) {
          await peerConnection.current.addIceCandidate(candidate);
          console.log("Added ICE candidate");
        } else {
          console.log("Queuing ICE candidate until remote description is set");
          pendingCandidates.current.push(candidate);
        }
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    });

    socketService.on("offer", async (data) => {
      console.log("Received offer for room:", data.roomId);

      // Only process if it's for our room
      if (data.roomId !== roomId) {
        console.log("Offer not for our room, ignoring");
        return;
      }

      try {
        if (!peerConnection.current) {
          console.error("No peer connection available");
          return;
        }

        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(data.offer)
        );
        hasSetRemoteDescription.current = true;
        console.log("Set remote description from offer");

        // Add any pending ICE candidates
        for (const candidate of pendingCandidates.current) {
          await peerConnection.current.addIceCandidate(candidate);
          console.log("Added pending ICE candidate");
        }
        pendingCandidates.current = [];

        setConnectionState("Creating answer...");
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        console.log("Created and set local description (answer)");

        socketService.emit("answer", { roomId, answer });
        console.log("Sent answer");
        setConnectionState("Answer sent, connecting...");
      } catch (error) {
        console.error("Error handling offer:", error);
      }
    });

    socketService.on("answer", async (data) => {
      console.log("Received answer for room:", data.roomId);

      // Only process if it's for our room
      if (data.roomId !== roomId) {
        console.log("Answer not for our room, ignoring");
        return;
      }

      try {
        if (!peerConnection.current) {
          console.error("No peer connection available");
          return;
        }

        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        hasSetRemoteDescription.current = true;
        console.log("Set remote description from answer");

        // Add any pending ICE candidates
        for (const candidate of pendingCandidates.current) {
          await peerConnection.current.addIceCandidate(candidate);
          console.log("Added pending ICE candidate");
        }
        pendingCandidates.current = [];

        setConnectionState("Connecting...");
      } catch (error) {
        console.error("Error handling answer:", error);
      }
    });

    socketService.on("call-ended", () => {
      console.log("Call ended by remote party");
      Alert.alert("Call Ended", "The other party ended the call");
      endCall();
    });
  };

  const createOffer = async () => {
    try {
      if (!peerConnection.current || !isSetupComplete.current) {
        console.log("Peer connection not ready, retrying...");
        setTimeout(createOffer, 500);
        return;
      }

      console.log("Creating offer...");
      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });

      await peerConnection.current.setLocalDescription(offer);
      console.log("Set local description (offer)");

      socketService.emit("offer", { roomId, offer });
      console.log("Sent offer to room:", roomId);
      setConnectionState("Offer sent, waiting for answer...");
    } catch (error) {
      console.error("Error creating offer:", error);
      Alert.alert("Error", "Failed to create call offer");
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        console.log("Mute toggled:", !audioTrack.enabled);
      }
    }
  };

  const toggleSpeaker = () => {
    const newSpeakerState = !isSpeakerOn;
    InCallManager.setSpeakerphoneOn(newSpeakerState);
    setIsSpeakerOn(newSpeakerState);
    console.log("Speaker toggled:", newSpeakerState);
  };

  const cleanup = () => {
    try {
      console.log("Cleaning up call resources...");

      // Leave the room
      socketService.emit("leave-room", roomId);

      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          track.stop();
          console.log("Stopped track:", track.kind);
        });
      }

      // Close peer connection
      if (peerConnection.current) {
        peerConnection.current.close();
        console.log("Closed peer connection");
      }

      // Stop InCallManager
      InCallManager.stop();
      console.log("Stopped InCallManager");

      // Clear timer
      if (callTimer.current) {
        clearInterval(callTimer.current);
        callTimer.current = null;
      }

      // Remove socket listeners
      socketService.off("ice-candidate");
      socketService.off("offer");
      socketService.off("answer");
      socketService.off("call-ended");
      console.log("Removed socket listeners");
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  };

  const endCall = async () => {
    try {
      console.log("Ending call...");

      // Notify other party
      socketService.emit("end-call", { roomId });

      cleanup();

      // End call on server
      const callId = roomId.split("-")[1];
      await api.post(`/call/end/${callId}`, {
        endedBy: isInitiator ? "user" : "therapist",
      });

      navigation.goBack();
    } catch (error) {
      console.error("Error ending call:", error);
      navigation.goBack();
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
      {/* Header with connection status */}
      <View style={styles.header}>
        <Text style={styles.connectionStatus}>{connectionState}</Text>
        {isConnected && (
          <Text style={styles.duration}>{formatDuration(callDuration)}</Text>
        )}
        {/* Debug info */}
        <Text style={styles.debugText}>
          Role: {isInitiator ? "User (Initiator)" : "Therapist (Receiver)"}
        </Text>

        <Text style={styles.debugText}>Room: {roomId}</Text>
      </View>

      {/* Main call area */}
      <View style={styles.callArea}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{isInitiator ? "T" : "U"}</Text>
          </View>
          <Text style={styles.participantName}>
            {isInitiator ? "Therapist" : "User"}
          </Text>
        </View>
      </View>

      {/* Control buttons */}
      <View style={styles.controls}>
        <View style={styles.controlRow}>
          {/* Mute button */}
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.activeButton]}
            onPress={toggleMute}
          >
            <Text style={[styles.controlIcon, isMuted && styles.activeIcon]}>
              {isMuted ? "🔇" : "🎤"}
            </Text>
            <Text style={[styles.controlLabel, isMuted && styles.activeLabel]}>
              {isMuted ? "Unmute" : "Mute"}
            </Text>
          </TouchableOpacity>

          {/* Speaker button */}
          <TouchableOpacity
            style={[styles.controlButton, isSpeakerOn && styles.activeButton]}
            onPress={toggleSpeaker}
          >
            <Text
              style={[styles.controlIcon, isSpeakerOn && styles.activeIcon]}
            >
              {isSpeakerOn ? "🔊" : "🔉"}
            </Text>
            <Text
              style={[styles.controlLabel, isSpeakerOn && styles.activeLabel]}
            >
              Speaker
            </Text>
          </TouchableOpacity>
        </View>

        {/* End call button */}
        <TouchableOpacity style={styles.endCallButton} onPress={endCall}>
          <Text style={styles.endCallIcon}>📞</Text>
          <Text style={styles.endCallText}>End Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1e1e1e",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: "center",
    backgroundColor: "#2a2a2a",
  },
  connectionStatus: {
    fontSize: 16,
    color: "#888",
    marginBottom: 8,
  },
  duration: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 10,
  },
  debugText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  callArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  avatarContainer: {
    alignItems: "center",
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#4A90E2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  avatarText: {
    fontSize: 48,
    color: "#fff",
    fontWeight: "bold",
  },
  participantName: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "500",
  },
  controls: {
    paddingHorizontal: 40,
    paddingBottom: 50,
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 40,
  },
  controlButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#3a3a3a",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  activeButton: {
    backgroundColor: "#4A90E2",
  },
  controlIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  activeIcon: {
    color: "#fff",
  },
  controlLabel: {
    fontSize: 12,
    color: "#ccc",
    fontWeight: "500",
  },
  activeLabel: {
    color: "#fff",
  },
  endCallButton: {
    backgroundColor: "#ff4444",
    paddingVertical: 20,
    borderRadius: 30,
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  endCallIcon: {
    fontSize: 24,
    marginBottom: 4,
    transform: [{ rotate: "135deg" }],
  },
  endCallText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
