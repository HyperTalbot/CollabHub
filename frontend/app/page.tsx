import CollabHubLanding from '@/components/landing/CollabHubLanding';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CollabHub - 7 платформ в одной | Социальная сеть будущего',
  description: 'Объединяем видео, стримы, музыку, посты, чаты и AI помощника Кола в одной соц сети. Это просто космос!',
  keywords: [
    'социальная сеть',
    'видео платформа', 
    'короткие видео',
    'стриминг',
    'музыка онлайн',
    'мессенджер',
    'AI помощник',
    'CollabHub'
  ],
  openGraph: {
    title: 'CollabHub - это просто космос!',
    description: '7 платформ в одной. Будущее социальных сетей уже здесь.',
    type: 'website',
    url: 'https://collabhub.com',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a',
        width: 1920,
        height: 1080,
        alt: 'CollabHub - космическая соц сеть',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CollabHub - это просто космос!',
    description: '7 платформ в одной соц сети',
  },
};

export default function LandingPage() {
  return <CollabHubLanding />;
}