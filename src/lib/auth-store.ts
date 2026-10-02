"use client";

import { create } from "zustand";
import type { SessionUser } from "@/lib/auth-cookies";

type AuthState = {
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
  clear: () => void;
  hasRole: (...roles: string[]) => boolean;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
  clear: () => set({ user: null }),
  hasRole: (...roles) => {
    const user = get().user;
    return !!user && roles.some((r) => user.roles.includes(r));
  },
}));
