// frontend/lib/getAuthToken.ts
import Cookies from 'js-cookie';

export function getAuthToken(): string | null {
  // Пробуем получить из cookies (приоритет)
  const token = Cookies.get('authToken'); // ИСПРАВЛЕНО: authToken вместо token

  if (token) {
    return token;
  }

  // Пробуем получить из localStorage
  if (typeof window !== 'undefined') {
    const localToken = localStorage.getItem('authToken'); // ИСПРАВЛЕНО: authToken вместо token
    if (localToken) {
      return localToken;
    }
  }

  return null;
}
