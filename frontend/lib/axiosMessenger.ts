// frontend/lib/axiosMessenger.ts
import axios from 'axios';
import Cookies from 'js-cookie';

const baseURL = process.env.NEXT_PUBLIC_MESSENGER_API_URL || '/api/v1/messenger';

const axiosMessenger = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosMessenger.interceptors.request.use(
  (config) => {
    let token: string | undefined | null = Cookies.get('authToken');
    if (!token && typeof window !== 'undefined') {
      token = localStorage.getItem('authToken');
    }
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default axiosMessenger;