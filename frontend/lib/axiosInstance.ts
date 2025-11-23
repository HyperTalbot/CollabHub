// /frontend/lib/axiosInstance.ts
import axios from 'axios';
import Cookies from 'js-cookie';

const axiosInstance = axios.create({
  // Базовый URL можно оставить для постов, или убрать, 
  // так как мы часто используем полные URL
  baseURL: 'http://localhost:8081/api/v1', 
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерцептор запроса: Добавляет токен ко ВСЕМ запросам
axiosInstance.interceptors.request.use(
  (config) => {
    // 1. Пытаемся найти токен в Cookies (приоритет)
    let token: string | undefined | null = Cookies.get('authToken');
    
    // 2. Если нет в Cookies, ищем в localStorage
    if (!token && typeof window !== 'undefined') {
      token = localStorage.getItem('authToken');
    }

    // 3. Если токен найден, добавляем заголовок
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn("Axios Interceptor: Token not found in Cookies or LocalStorage");
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default axiosInstance;
