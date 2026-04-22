// Backend API Configuration
// Update API_URL with your computer's IP address

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:3000';

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  ENDPOINTS: {
    REGISTER_VISITOR: `${API_BASE_URL}/api/visitors/register`,
  },
};

export default API_CONFIG;
