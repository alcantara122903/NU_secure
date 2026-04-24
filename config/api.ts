// Backend API Configuration
// Set EXPO_PUBLIC_API_URL to the backend you actually want to call.
// The exit scan flow no longer uses a local PC IP or Laravel endpoint.

const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || '';

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, '');

const API_BASE_URL = normalizeBaseUrl(rawApiBaseUrl);

if (!API_BASE_URL) {
  console.error('❌ EXPO_PUBLIC_API_URL is not configured.');
}

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  ENDPOINTS: {
    REGISTER_VISITOR: `${API_BASE_URL}/api/visitors/register`,
  },
};

export default API_CONFIG;
