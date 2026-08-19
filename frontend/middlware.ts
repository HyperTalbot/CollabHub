// /middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const authToken = request.cookies.get('authToken')?.value;
  const { pathname } = request.nextUrl;

  // --- Роуты, которые должен видеть ТОЛЬКО НЕзалогиненный пользователь ---
  const publicOnlyRoutes = ['/', '/login', '/register'];

  // --- Защищенные роуты (только для залогиненных) ---
  // Пока оставляем пустым, но здесь будут: /profile, /settings, /create-post и т.д.
  const protectedRoutes = ['/profile', '/settings', '/create-post']; 

  
  // 1. Пользователь залогинен (есть токен)
  if (authToken) {
    // Если он пытается зайти на /login, /register или главную /
    if (publicOnlyRoutes.some(route => pathname === route)) {
      // Перенаправляем его в приложение
      return NextResponse.redirect(new URL('/homepage', request.url));
    }
  }

  // 2. Пользователь НЕ залогинен (нет токена)
  if (!authToken) {
    // И пытается зайти на защищенный роут, который требует токена
    if (protectedRoutes.some(prefix => pathname.startsWith(prefix))) {
      // Перенаправляем его на страницу входа
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Во всех остальных случаях (включая /homepage) - разрешаем доступ
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};