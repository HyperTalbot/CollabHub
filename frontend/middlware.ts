// frontend/middleware.ts  (ПОЛНАЯ ЗАМЕНА)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const authToken = request.cookies.get('authToken')?.value;
  const { pathname } = request.nextUrl;

  // --- Роуты только для НЕзалогиненных ---
  const publicOnlyRoutes = ['/', '/login', '/register'];

  // --- Защищённые префиксы (только для залогиненных) ---
  // /profile/[id|username] ТЕПЕРЬ ОТКРЫТ ВСЕМ (страницы пользователей),
  // защищён только ТОЧНЫЙ /profile (мой кабинет)
  const protectedRoutes = ['/settings', '/create-post'];
  const protectedExact = ['/profile'];

  // 1. Пользователь залогинен
  if (authToken) {
    if (publicOnlyRoutes.some(route => pathname === route)) {
      return NextResponse.redirect(new URL('/homepage', request.url));
    }
  }

  // 2. Пользователь НЕ залогинен
  if (!authToken) {
    const isProtected =
      protectedExact.some(p => pathname === p) ||
      protectedRoutes.some(prefix => pathname.startsWith(prefix));
    if (isProtected) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};




// // /middleware.ts

// import { NextResponse } from 'next/server';
// import type { NextRequest } from 'next/server';

// export function middleware(request: NextRequest) {
//   const authToken = request.cookies.get('authToken')?.value;
//   const { pathname } = request.nextUrl;

//   // --- Роуты, которые должен видеть ТОЛЬКО НЕзалогиненный пользователь ---
//   const publicOnlyRoutes = ['/', '/login', '/register'];

//   // --- Защищенные роуты (только для залогиненных) ---
//   // Пока оставляем пустым, но здесь будут: /profile, /settings, /create-post и т.д.
//   const protectedRoutes = ['/profile', '/settings', '/create-post']; 

  
//   // 1. Пользователь залогинен (есть токен)
//   if (authToken) {
//     // Если он пытается зайти на /login, /register или главную /
//     if (publicOnlyRoutes.some(route => pathname === route)) {
//       // Перенаправляем его в приложение
//       return NextResponse.redirect(new URL('/homepage', request.url));
//     }
//   }

//   // 2. Пользователь НЕ залогинен (нет токена)
//   if (!authToken) {
//     // И пытается зайти на защищенный роут, который требует токена
//     if (protectedRoutes.some(prefix => pathname.startsWith(prefix))) {
//       // Перенаправляем его на страницу входа
//       return NextResponse.redirect(new URL('/login', request.url));
//     }
//   }

//   // Во всех остальных случаях (включая /homepage) - разрешаем доступ
//   return NextResponse.next();
// }

// export const config = {
//   matcher: [
//     '/((?!api|_next/static|_next/image|favicon.ico).*)',
//   ],
// };