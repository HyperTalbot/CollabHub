// /frontend/lib/axiosInstance.ts
import axios from 'axios';
import Cookies from 'js-cookie';

const axiosInstance = axios.create({
  baseURL: 'http://localhost:8082/api/v1', 
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // ИСПРАВЛЕНИЕ: Явно указываем тип
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

// Response Interceptor (для 401 ошибки)
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Логика редиректа на логин, если токен протух
      if (typeof window !== 'undefined') {
          // Не удаляем куки сразу, чтобы не моргало, или удаляем и редиректим
          // Cookies.remove('authToken');
          // localStorage.removeItem('authToken');
          // window.location.href = '/login'; 
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;