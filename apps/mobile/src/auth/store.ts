import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'wathba.auth.token';
const USER_KEY = 'wathba.auth.user';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  roles: string[];
  nafathVerified: boolean;
  reputationTier: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (token: string, user: AuthUser) => Promise<void>;
  setUser: (user: AuthUser) => Promise<void>;
  clear: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  async hydrate() {
    const [token, userJson] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY).catch(() => null),
      SecureStore.getItemAsync(USER_KEY).catch(() => null),
    ]);
    let user: AuthUser | null = null;
    if (userJson) {
      try {
        user = JSON.parse(userJson) as AuthUser;
      } catch {
        user = null;
      }
    }
    set({ token, user, hydrated: true });
  },
  async setSession(token, user) {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    ]);
    set({ token, user });
  },
  async setUser(user) {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ user });
  },
  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined),
      SecureStore.deleteItemAsync(USER_KEY).catch(() => undefined),
    ]);
    set({ token: null, user: null });
  },
}));
