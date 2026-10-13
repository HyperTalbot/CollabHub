// frontend/lib/ringtone.ts  (НОВЫЙ ФАЙЛ)
//
// Синтезированные "гудки" через Web Audio API — без внешних mp3-файлов.
// startRingback() — гудки у ЗВОНЯЩЕГО (ожидание ответа), 1 длинный гудок каждые 3 сек
// startRingtone() — мелодия у ПРИНИМАЮЩЕГО (входящий звонок), 2 коротких каждые 2 сек
// stopSounds()    — остановить всё

let audioCtx: AudioContext | null = null;
let intervalId: number | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    // Браузеры блокируют аудио без жеста пользователя — пробуем снять блокировку
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    console.warn('AudioContext unavailable:', e);
    return null;
  }
}

function beep(freq: number, startIn: number, duration: number, gainValue = 0.12) {
  const ac = getCtx();
  if (!ac) return;

  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'sine';
  osc.frequency.value = freq;

  const t0 = ac.currentTime + startIn;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(gainValue, t0 + 0.04);
  gain.gain.setValueAtTime(gainValue, t0 + duration - 0.06);
  gain.gain.linearRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export function stopSounds() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// Гудки звонящего (классические: ~1 сек гудок, пауза ~2 сек)
export function startRingback() {
  stopSounds();
  const play = () => {
    beep(440, 0, 0.9, 0.10);
  };
  play();
  intervalId = window.setInterval(play, 3000);
}

// Мелодия входящего звонка (два коротких "дин-дин", повтор каждые 2 сек)
export function startRingtone() {
  stopSounds();
  const play = () => {
    beep(880, 0, 0.35, 0.16);
    beep(880, 0.55, 0.35, 0.16);
  };
  play();
  intervalId = window.setInterval(play, 2000);
}