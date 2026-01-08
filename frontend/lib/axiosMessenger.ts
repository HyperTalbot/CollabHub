// lib/axiosMessenger.ts
import axios from 'axios';
import Cookies from 'js-cookie';

// ВАЖНО: Порт 8086 для чат-сервиса
const axiosMessenger = axios.create({
  baseURL: 'http://localhost:8086/api/v1', 
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