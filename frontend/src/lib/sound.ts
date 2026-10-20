// Bip de alerta (Web Audio). A preferência fica no navegador — é só conveniência por dispositivo.

const KEY = 'orbnoc_alert_sound';

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(KEY, enabled ? 'on' : 'off');
  } catch {
    /* armazenamento indisponível: segue com o padrão */
  }
}

export function playAlertSound(severity: 'error' | 'warning' | 'success' | 'info'): void {
  if (!isSoundEnabled()) return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = severity === 'error' ? 'sawtooth' : severity === 'warning' ? 'square' : 'sine';
    osc.frequency.value = severity === 'error' ? 440 : severity === 'warning' ? 660 : 880;
    gain.gain.value = 0.2;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.5);
    setTimeout(() => void ctx.close(), 600);
  } catch {
    /* sem áudio: ignora */
  }
}
