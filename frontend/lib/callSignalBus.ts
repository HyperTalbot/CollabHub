// frontend/lib/callSignalBus.ts

export type CallSignal = {
  call_id: number;
  from_id?: number;
  // 'offer' | 'answer' | 'ice' | 'answered'
  signal_type: string;
  data?: any;
  candidate?: any;
};

type SignalListener = (signal: CallSignal) => void;

const listeners = new Set<SignalListener>();
const buffer: CallSignal[] = [];
const MAX_BUFFER = 500;

/** Вызывается из WebSocketContext при получении любого call-события */
export function emitCallSignal(signal: CallSignal) {
  if (!signal || signal.call_id === undefined || signal.call_id === null) return;

  // Подписчиков нет (модалка ещё не открыта) — буферизуем
  if (listeners.size === 0) {
    buffer.push(signal);
    if (buffer.length > MAX_BUFFER) {
      buffer.splice(0, buffer.length - MAX_BUFFER);
    }
    return;
  }

  listeners.forEach((listener) => {
    try {
      listener(signal);
    } catch (e) {
      console.error('❌ callSignal listener error:', e);
    }
  });
}

/**
 * Подписка на сигналы. При подписке СРАЗУ отдаёт всё, что накопилось в буфере
 * (это закрывает гонку "сигнал пришёл за миллисекунду до монтирования модалки").
 * Возвращает функцию отписки.
 */
export function subscribeCallSignals(listener: SignalListener): () => void {
  listeners.add(listener);

  if (buffer.length > 0) {
    const pending = buffer.splice(0, buffer.length);
    pending.forEach((signal) => {
      try {
        listener(signal);
      } catch (e) {
        console.error('❌ buffered signal error:', e);
      }
    });
  }

  return () => {
    listeners.delete(listener);
  };
}

/** Полная очистка буфера (при новом/завершённом звонке) */
export function clearCallSignals() {
  buffer.length = 0;
}

/** Сколько сигналов сейчас в буфере — для отладки */
export function getBufferedCount(): number {
  return buffer.length;
}