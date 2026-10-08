// frontend/lib/axiosInstance.ts
import axios from 'axios';
import Cookies from 'js-cookie';

// Определяем baseURL в зависимости от окружения
const getBaseURL = () => {
  // В production (cloudpub)
  if (typeof window !== 'undefined' && window.location.hostname === 'collabhub.cloudpub.ru') {
    return '/api/v1/auth';
  }
  
  // В development (localhost)
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8080/api/v1/auth';
  }
  
  // Fallback
  return process.env.NEXT_PUBLIC_AUTH_API_URL || '/api/v1/auth';
};

const baseURL = getBaseURL();
console.log('🔧 Auth API Base URL:', baseURL);

const axiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    // Логируем полный URL запроса
    console.log('📤 Request URL:', baseURL + config.url);
    
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

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('❌ Response error:', error.response?.status, error.config?.url);
    
    if (error.response && error.response.status === 401) {
      if (typeof window !== 'undefined') {
        Cookies.remove('authToken');
        localStorage.removeItem('authToken');
        window.location.href = '/login'; 
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
