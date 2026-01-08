// frontend/services/uploadService.ts
import axios from 'axios';
import Cookies from 'js-cookie';

const MEDIA_API_URL = 'http://localhost:8087/api/v1';

export const uploadFile = async (file: File, type: string = 'misc'): Promise<string> => {
    const token = Cookies.get('authToken') || localStorage.getItem('authToken');
    if (!token) throw new Error("No token");

    const formData = new FormData();
    formData.append('file', file);

     // Добавляем ?type=avatar к URL
    const response = await axios.post(`${MEDIA_API_URL}/upload?type=${type}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
        }
    });

    return response.data.url; // Возвращает ссылку на файл
};