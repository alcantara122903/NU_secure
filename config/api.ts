import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_API_PORT = 3000;

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

const isLoopbackHost = (host: string): boolean =>
  host === 'localhost' || host === '127.0.0.1' || host === '10.0.2.2' || host === '::1';

const isPrivateLanHost = (host: string): boolean =>
  /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host);

const parseUrlParts = (
  rawUrl: string,
): { protocol: 'http' | 'https'; hostname: string; port: number } | null => {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const protocol = parsed.protocol === 'https:' ? 'https' : 'http';
    const port = parsed.port
      ? Number(parsed.port)
      : protocol === 'https'
        ? 443
        : 80;
    return { protocol, hostname: parsed.hostname, port };
  } catch {
    return null;
  }
};

const expoDevHost = (): string | null => {
  const candidates = [Constants.expoConfig?.hostUri, Constants.linkingUri].filter(
    (value): value is string => Boolean(value),
  );

  for (const candidate of candidates) {
    const ipv4 = candidate.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
    if (ipv4) {
      return ipv4[1];
    }
  }

  return null;
};

const resolveApiBaseUrl = (): string => {
  const envUrl = stripTrailingSlash(process.env.EXPO_PUBLIC_API_URL?.trim() || '');
  const envParts = parseUrlParts(envUrl);
  const protocol = envParts?.protocol ?? 'http';
  const port = envParts?.port && envParts.port !== 80 && envParts.port !== 443
    ? envParts.port
    : envParts?.protocol === 'https'
      ? 443
      : DEFAULT_API_PORT;

  if (envParts && !isLoopbackHost(envParts.hostname) && !isPrivateLanHost(envParts.hostname)) {
    return envUrl;
  }

  const devHost = expoDevHost();
  if (devHost && (isPrivateLanHost(devHost) || isLoopbackHost(devHost))) {
    const host =
      Platform.OS === 'android' && isLoopbackHost(devHost) ? '10.0.2.2' : devHost;
    return `${protocol}://${host}:${port}`;
  }

  if (envUrl) {
    if (Platform.OS === 'android' && envParts && isLoopbackHost(envParts.hostname)) {
      return `${protocol}://10.0.2.2:${port}`;
    }
    return envUrl;
  }

  return '';
};

export const API_BASE_URL = resolveApiBaseUrl();

if (!API_BASE_URL) {
  console.error('EXPO_PUBLIC_API_URL is not configured.');
} else {
  console.log(`[api] Using ${API_BASE_URL}`);
}

export const API_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/api/login`,
  LOGOUT: `${API_BASE_URL}/api/logout`,
  USER: `${API_BASE_URL}/api/user`,
  REGISTER_VISITOR: `${API_BASE_URL}/api/visitors/register`,
};

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  ENDPOINTS: API_ENDPOINTS,
};

export default API_CONFIG;
