// frontend/lib/getAuthToken.ts
import Cookies from 'js-cookie';

export function getAuthToken(): string | null {
  // Пробуем получить из cookies (приоритет)
  let token = Cookies.get('authToken'); // ИСПРАВЛЕНО: authToken вместо token
  
  if (token) {
    return token;
  }
  
  // Пробуем получить из localStorage
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('authToken'); // ИСПРАВЛЕНО: authToken вместо token
    if (token) {
      return token;
    }
  }
  
  return null;
}
