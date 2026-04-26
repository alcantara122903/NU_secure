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

  getCurrentUserDisplayName(): string | null {
    const firstName = currentSession?.userProfile?.first_name?.trim();
    const lastName = currentSession?.userProfile?.last_name?.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (fullName) {
      return fullName;
    }

    const email = currentSession?.userProfile?.email?.trim() || currentSession?.user?.email?.trim();
    if (email) {
      return email;
    }

    return null;
  },

  getCurrentUserFirstName(): string | null {
    const firstName = currentSession?.userProfile?.first_name?.trim();
    if (firstName) {
      return firstName;
    }

    const fullName = currentSession?.user?.name?.trim();
    if (fullName) {
      const firstToken = fullName.split(/\s+/)[0]?.trim();
      if (firstToken) {
        return firstToken;
      }
    }

    const email = currentSession?.userProfile?.email?.trim() || currentSession?.user?.email?.trim();
    if (email && email.includes('@')) {
      const localPart = email.split('@')[0]?.trim();
      return localPart || null;
    }

    return null;
  },

  /** First and last name from profile, or combined `user.name`, with light fallbacks. */
  getCurrentUserFirstLastName(): string | null {
    const firstName = currentSession?.userProfile?.first_name?.trim();
    const lastName = currentSession?.userProfile?.last_name?.trim();
    const fromProfile = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (fromProfile) {
      return fromProfile;
    }

    const fullName = currentSession?.user?.name?.trim();
    if (fullName) {
      return fullName;
    }

    return this.getCurrentUserFirstName();
  },

  clearSession(): void {
    currentSession = null;
  },
};