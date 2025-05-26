// src/store/authSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";

export const sendOTP = createAsyncThunk("auth/sendOTP", async (phoneNumber) => {
  const response = await api.post("/auth/send-otp", { phoneNumber });
  return response.data;
});

export const verifyOTP = createAsyncThunk(
  "auth/verifyOTP",
  async ({ phoneNumber, otp }) => {
    const response = await api.post("/auth/verify-otp", { phoneNumber, otp });
    await AsyncStorage.setItem("token", response.data.token);
    await AsyncStorage.setItem("userType", "user");
    return response.data;
  }
);

export const therapistLogin = createAsyncThunk(
  "auth/therapistLogin",
  async ({ email, password }) => {
    const response = await api.post("/auth/therapist-login", {
      email,
      password,
    });
    await AsyncStorage.setItem("token", response.data.token);
    await AsyncStorage.setItem("userType", "therapist");
    return response.data;
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    therapist: null,
    userType: null,
    token: null,
    loading: false,
    error: null,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.therapist = null;
      state.userType = null;
      state.token = null;
      AsyncStorage.removeItem("token");
      AsyncStorage.removeItem("userType");
    },
    setAuth: (state, action) => {
      state.token = action.payload.token;
      state.userType = action.payload.userType;
      if (action.payload.userType === "user") {
        state.user = action.payload.user;
      } else {
        state.therapist = action.payload.therapist;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendOTP.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendOTP.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(sendOTP.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(verifyOTP.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.userType = "user";
      })
      .addCase(therapistLogin.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.therapist = action.payload.therapist;
        state.userType = "therapist";
      });
  },
});

export const { logout, setAuth } = authSlice.actions;
export default authSlice.reducer;
