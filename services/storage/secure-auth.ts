import type { UserProfile } from '@/types/auth';
import { Platform } from 'react-native';

const TOKEN_KEY = 'nu_secure.auth.token';
const USER_KEY = 'nu_secure.auth.user';

const memoryStore = new Map<string, string>();

type SecureStoreApi = {
  setItemAsync: (key: string, value: string) => Promise<void>;
  getItemAsync: (key: string) => Promise<string | null>;
  deleteItemAsync: (key: string) => Promise<void>;
};

function loadNativeSecureStore(): SecureStoreApi | null {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    return require('expo-secure-store') as SecureStoreApi;
  } catch {
    return null;
  }
}

const nativeStore = loadNativeSecureStore();

async function setItem(key: string, value: string): Promise<void> {
  if (nativeStore) {
    await nativeStore.setItemAsync(key, value);
    return;
  }

  memoryStore.set(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (nativeStore) {
    return nativeStore.getItemAsync(key);
  }

  return memoryStore.get(key) ?? null;
}

async function deleteItem(key: string): Promise<void> {
  if (nativeStore) {
    await nativeStore.deleteItemAsync(key);
    return;
  }

  memoryStore.delete(key);
}

export const secureAuthStorage = {
  async saveSession(token: string, userProfile: UserProfile): Promise<void> {
    await setItem(TOKEN_KEY, token);
    await setItem(USER_KEY, JSON.stringify(userProfile));
  },

  async loadSession(): Promise<{ token: string; userProfile: UserProfile | null } | null> {
    const token = await getItem(TOKEN_KEY);
    if (!token) {
      return null;
    }

    const rawUser = await getItem(USER_KEY);
    if (!rawUser) {
      return { token, userProfile: null };
    }

    try {
      return { token, userProfile: JSON.parse(rawUser) as UserProfile };
    } catch {
      return { token, userProfile: null };
    }
  },

  async clearSession(): Promise<void> {
    await deleteItem(TOKEN_KEY);
    await deleteItem(USER_KEY);
  },
};
