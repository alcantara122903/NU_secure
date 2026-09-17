/**
 * In-memory handoff for visitor QR ticket screens.
 * Expo Router params truncate large payloads / temp ImagePicker URIs often break after navigation.
 */

import * as FileSystem from 'expo-file-system/legacy';

export type VisitorTicketHandoffPayload = Record<string, unknown> & {
  facePhotoUri?: string;
};

let pendingTicket: VisitorTicketHandoffPayload | null = null;

/** Copy a local ImagePicker URI into a stable cache path so it survives navigation. */
export async function persistTicketFacePhotoUri(
  uri: string | null | undefined,
): Promise<string | undefined> {
  const value = (uri || '').trim();
  if (!value) {
    return undefined;
  }

  // Already durable for Image display
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:')
  ) {
    return value;
  }

  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) {
      return value;
    }
    const dest = `${cacheDir}ticket-face-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: value, to: dest });
    return dest;
  } catch (error) {
    if (__DEV__) {
      console.warn('[ticket-handoff] could not persist face photo URI:', error);
    }
    return value;
  }
}

export function setPendingVisitorTicket(
  payload: VisitorTicketHandoffPayload,
): void {
  pendingTicket = payload;
}

/** Read and clear the pending ticket (preferred over route params). */
export function takePendingVisitorTicket(): VisitorTicketHandoffPayload | null {
  const next = pendingTicket;
  pendingTicket = null;
  return next;
}

export function peekPendingVisitorTicket(): VisitorTicketHandoffPayload | null {
  return pendingTicket;
}
