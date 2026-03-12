// frontend/services/uploadService.ts
import axios from 'axios';
import Cookies from 'js-cookie';

const MEDIA_API_URL = process.env.NEXT_PUBLIC_MEDIA_API_URL || '/api/v1/media';

// Универсальная функция загрузки
export const uploadFile = async (
  file: File, 
  type: 'image' | 'audio' | 'video' | 'misc' = 'misc'
): Promise<string> => {
  const token = Cookies.get('authToken') || localStorage.getItem('authToken');
  if (!token) throw new Error("Необходимо войти в систему");

  const formData = new FormData();
  formData.append('file', file);

  // Выбираем правильный endpoint
  let endpoint = '';
  switch (type) {
    case 'image':
      endpoint = `${MEDIA_API_URL}/upload/image`;
      break;
    case 'audio':
      endpoint = `${MEDIA_API_URL}/upload/audio`;
      break;
    case 'video':
      endpoint = `${MEDIA_API_URL}/upload/video`;
      break;
    default:
      endpoint = `${MEDIA_API_URL}/upload/file`;
  }

  const response = await axios.post(endpoint, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'Authorization': `Bearer ${token}`
    }
  });

  // ИСПРАВЛЕНО: media-service возвращает url, не file_path
  return response.data.url || response.data.file_path;
};

// Для обратной совместимости
export const uploadImage = (file: File) => uploadFile(file, 'image');
export const uploadAudio = (file: File) => uploadFile(file, 'audio');
export const uploadVideo = (file: File) => uploadFile(file, 'video');





// // frontend/services/uploadService.ts
// import axios from 'axios';
// import Cookies from 'js-cookie';

// // const MEDIA_API_URL = 'http://localhost:8088/api/v1';
// const MEDIA_API_URL = process.env.NEXT_PUBLIC_MEDIA_API_URL || '/api/v1/media';

// export const uploadFile = async (file: File, type: string = 'misc'): Promise<string> => {
//     const token = Cookies.get('authToken') || localStorage.getItem('authToken');
//     if (!token) throw new Error("No token");

//     const formData = new FormData();
//     formData.append('file', file);

//      // Добавляем ?type=avatar к URL
//      const response = await axios.post(`${MEDIA_API_URL}/upload/image`, formData, {
//         headers: {
//             'Content-Type': 'multipart/form-data',
//             'Authorization': `Bearer ${token}`
//         }
//     });

//     return response.data.url; // Возвращает ссылку на файл
// };