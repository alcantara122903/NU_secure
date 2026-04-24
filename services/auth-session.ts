import type { User } from '@/types/auth';

interface AuthSession {
  token?: string;
  user: User;
  userProfile?: {
    user_id: number;
    email: string;
    first_name?: string;
    last_name?: string;
    role_id: number;
    status?: string;
  };
}

let currentSession: AuthSession | null = null;

export const authSessionService = {
  setSession(session: AuthSession): void {
    currentSession = session;
  },

  getSession(): AuthSession | null {
    return currentSession;
  },

  getCurrentUserId(): number | null {
    if (currentSession?.userProfile?.user_id) {
      return currentSession.userProfile.user_id;
    }

    const parsedUserId = Number(currentSession?.user?.id);
    return Number.isFinite(parsedUserId) ? parsedUserId : null;
  },

  clearSession(): void {
    currentSession = null;
  },
};