// /frontend/lib/axiosInstance.ts
import axios from "axios";
import Cookies from "js-cookie";

const axiosInstance = axios.create();

// Interceptor (перехватчик) 
// будет выполняться ПЕРЕД каждым запросом 
axiosInstance.interceptors.request.use((config) => {
    const token = Cookies.get('authToken');

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config
},
    (error) => {
        return Promise.reject(error);
    }
);

export default axiosInstance;
