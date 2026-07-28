/**
 * Utilitário de áudio para notificações de novos leads.
 *
 * ESTRATÉGIA:
 * Utiliza Web Audio API (AudioContext) como motor principal e HTML5 Audio como fallback.
 * O AudioContext é desbloqueado nas interações do usuário (clique, toque ou tecla)
 * e o buffer do som de notificação é pré-decodificado na memória.
 * Isso garante reprodução instantânea e sem bloqueios de Autoplay quando
 * um lead ou venda chega via WebSockets / Supabase Realtime em segundo plano.
 */

const SOUND_URL = '/anime-wow-sound-effect-mp3cut.mp3';

let audioCtx: AudioContext | null = null;
let cachedBuffer: AudioBuffer | null = null;
let isBufferLoading = false;
let lastPlayTimestamp = 0;

function getAbsoluteUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  return url.startsWith('/') ? window.location.origin + url : url;
}

function resolveTargetUrl(): string {
  const saved = typeof window !== 'undefined'
    ? localStorage.getItem('asthros-sound-url')
    : null;

  if (!saved || saved.includes('mixkit.co')) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('asthros-sound-url', SOUND_URL);
      localStorage.setItem('asthros-sound-type', 'animewow');
    }
    return getAbsoluteUrl(SOUND_URL);
  }

  return getAbsoluteUrl(saved);
}

function initAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

async function loadBuffer(url: string) {
  const ctx = initAudioContext();
  if (!ctx || isBufferLoading) return;

  try {
    isBufferLoading = true;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    cachedBuffer = await ctx.decodeAudioData(arrayBuffer);
  } catch (err) {
    console.warn('[Audio] Erro ao carregar/decodificar buffer de áudio:', err);
  } finally {
    isBufferLoading = false;
  }
}

/**
 * Pré-carrega e autoriza o AudioContext e o buffer de áudio nas interações do usuário.
 */
export function primeAudio() {
  if (typeof window === 'undefined') return;
  const ctx = initAudioContext();
  const targetUrl = resolveTargetUrl();
  if (!cachedBuffer) {
    loadBuffer(targetUrl);
  }
}

/**
 * Toca o áudio de notificação com volume/ganho amplificado.
 */
export function playBoostedAudio(customUrl?: string, gainMultiplier: number = 3.5) {
  if (typeof window === 'undefined') return;

  const isSoundEnabled = localStorage.getItem('asthros-sound-enabled') !== 'false';
  if (!isSoundEnabled) return;

  // Debounce de 500ms para evitar sons sobrepostos
  const now = Date.now();
  if (now - lastPlayTimestamp < 500) return;
  lastPlayTimestamp = now;

  const targetUrl = customUrl ? getAbsoluteUrl(customUrl) : resolveTargetUrl();
  const ctx = initAudioContext();

  let playedViaWebAudio = false;

  if (ctx && cachedBuffer) {
    try {
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const source = ctx.createBufferSource();
      source.buffer = cachedBuffer;

      const gainNode = ctx.createGain();
      gainNode.gain.value = gainMultiplier;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.start(0);
      playedViaWebAudio = true;
    } catch (e) {
      console.warn('[Audio] Fallback para HTML5 Audio devido a erro no WebAudio:', e);
    }
  }

  // Fallback caso o buffer ainda esteja carregando ou ocorra algum imprevisto
  if (!playedViaWebAudio) {
    try {
      const audio = new Audio(targetUrl);
      audio.volume = 1.0;
      audio.play().catch((err) => {
        console.warn('[Audio] HTML5 Audio play falhou:', err);
      });
      loadBuffer(targetUrl);
    } catch (err) {}
  }
}
