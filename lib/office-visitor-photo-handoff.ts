/**
 * Short-lived handoff for office visitor-info face photo.
 * Avoids Expo Router truncating long signed Supabase URLs in params.
 */

let pendingOfficeVisitorPhotoUri: string | null = null;

export function setPendingOfficeVisitorPhotoUri(
  uri: string | null | undefined,
): void {
  const value = (uri || "").trim();
  pendingOfficeVisitorPhotoUri = value || null;
}

export function consumePendingOfficeVisitorPhotoUri(): string | null {
  const value = pendingOfficeVisitorPhotoUri;
  pendingOfficeVisitorPhotoUri = null;
  return value;
}

export function peekPendingOfficeVisitorPhotoUri(): string | null {
  return pendingOfficeVisitorPhotoUri;
}
