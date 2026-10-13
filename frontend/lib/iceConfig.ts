// frontend/lib/iceConfig.ts
// Единая конфигурация ICE-серверов. Как только поднимете свой coturn —
// пропишите его здесь через .env и уберите публичный metered.

// ⚠️ ГЛАВНОЕ ПРО ТЕЛЕФОН ↔ ТЕЛЕФОН:
// Оба смартфона сидят за симметричным NAT мобильного оператора (CGNAT).
// STUN там не помогает ВООБЩЕ — P2P-отверстие пробить невозможно.
// Единственный рабочий вариант — TURN relay. Публичный openrelay.metered.ca
// жёстко лимитирован (ошибка 438 quota exceeded) и часто не выдаёт relay,
// поэтому телефон↔телефон и не соединялся.
//
// Поднимите свой coturn (docker-compose ниже) и пропишите в .env.local:
//   NEXT_PUBLIC_TURN_URL=turn:collabhub.cloudpub.ru:3478,turns:collabhub.cloudpub.ru:5349
//   NEXT_PUBLIC_TURN_USERNAME=collabhub
//   NEXT_PUBLIC_TURN_CREDENTIAL=ВашДлинныйСекрет

// Несколько URL можно перечислить через запятую.

export interface IceDiagnostics {
  local: Record<string, number>;  // типы своих кандидатов
  remote: Record<string, number>; // типы кандидатов собеседника
  relayAllocated: boolean;        // удалось ли получить relay от TURN
}

export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    // Google STUN в РФ часто недоступен (поэтому у тебя и не было srflx).
    // Nextcloud STUN на 443 (https-порт) режется реже — запасной вариант.
    { urls: 'stun:stun.nextcloud.com:443' },
  ];

  const turnUrlRaw = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnPass = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnUrlRaw && turnUser && turnPass) {
    // СВОЙ coturn — надёжный relay для мобильных сетей.
    // Пароль ДОЛЖЕН совпадать с тем, что прописан в infra/docker-compose.yml.
    const urls = turnUrlRaw
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);

    servers.push({ urls, username: turnUser, credential: turnPass });
    console.log('🧊 ICE: self-hosted TURN configured →', urls);
  } else {
    console.warn('⚠️ ICE: self-hosted TURN не настроен (NEXT_PUBLIC_TURN_*)');
  }

  // Резервный публичный TURN. Браузер собирает relay-кандидаты со ВСЕХ
  // серверов параллельно: если свой coturn ещё не поднят/не отвечает,
  // metered даёт хотя бы шанс соединиться (иначе телефон↔телефон без relay
  // не работает вообще). Ненадёжен под нагрузкой, поэтому идёт вторым.
  servers.push({
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
      'turns:openrelay.metered.ca:443',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  });

  return servers;
}

/**
 * Достаёт тип ICE-кандидата из строки кандидата.
 * "host"   — локальная сеть (работает только внутри одной сети)
 * "srflx"  — адрес, видимый через STUN (работает, если NAT не симметричный)
 * "relay"  — адрес TURN-сервера (ЕДИНСТВЕННЫЙ вариант для мобильного интернета)
 * "prflx"  — peer-reflexive
 */
export function getCandidateType(candidate: any): string {
  const str: string =
    typeof candidate === 'string' ? candidate : candidate?.candidate || '';

  const match = str.match(/\btyp\s+(host|srflx|prflx|relay)\b/i);
  return match ? match[1].toLowerCase() : 'unknown';
}

export function incrementType(
  stats: Record<string, number>,
  type: string
): Record<string, number> {
  return { ...stats, [type]: (stats[type] || 0) + 1 };
}

/** Человекочитаемая сводка для отладочной плашки */
export function formatIceStats(stats: Record<string, number>): string {
  const order = ['host', 'srflx', 'prflx', 'relay'];
  const parts = order
    .filter((k) => stats[k])
    .map((k) => `${k}:${stats[k]}`);
  return parts.length ? parts.join(' ') : 'нет';
}