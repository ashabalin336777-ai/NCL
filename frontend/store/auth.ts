"use client";

import { create } from "zustand";

import {
  clearAuthTokens,
  getAccessToken,
  setAuthTokens,
} from "@/lib/cookies";
import { fetchMe, loginRequest, logoutRequest } from "@/lib/api";
import type { User } from "@/types/api";

interface AuthState {
  user: User | null;
  hydrated: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  loading: false,
  setUser: (user) => set({ user }),
  hydrate: async () => {
    const token = getAccessToken();
    if (!token) {
      set({ user: null, hydrated: true });
      return;
    }
    try {
      const user = await fetchMe();
      set({ user, hydrated: true });
    } catch {
      clearAuthTokens();
      set({ user: null, hydrated: true });
    }
  },
  login: async (email, password) => {
    set({ loading: true });
    try {
      const tokens = await loginRequest(email, password);
      setAuthTokens(tokens.access_token, tokens.refresh_token);
      set({ user: tokens.user, hydrated: true, loading: false });
      return tokens.user;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },
  logout: async () => {
    await logoutRequest();
    clearAuthTokens();
    set({ user: null });
  },
}));
