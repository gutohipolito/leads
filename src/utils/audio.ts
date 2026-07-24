/**
 * Utilitário robusto para tocar áudio de notificação de novos leads.
 * Utiliza um elemento de áudio compartilhado (Singleton) desbloqueado no primeiro clique/toque,
 * evita colisões de som simultâneos (debouncing) e contorna bloqueios de Autoplay dos navegadores.
 */

let sharedAudio: HTMLAudioElement | null = null;
let isUnlocked = false;
let lastPlayTimestamp = 0;

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.volume = 1.0;
  }
  return sharedAudio;
}

// Desbloqueia o elemento de áudio compartilhado na primeira interação do usuário na página
if (typeof window !== 'undefined') {
  const unlock = () => {
    const audio = getSharedAudio();
    if (audio && !isUnlocked) {
      try {
        audio.src = window.location.origin + '/anime-wow-sound-effect-mp3cut.mp3';
        audio.volume = 0.001; // Praticamente inaudível no desbloqueio
        const p = audio.play();
        if (p !== undefined) {
          p.then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 1.0;
            isUnlocked = true;
          }).catch(() => {});
        }
      } catch (e) {}
    }
    window.removeEventListener('click', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };

  window.addEventListener('click', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
}

export function playBoostedAudio(soundUrl?: string, gainMultiplier: number = 3.5) {
  if (typeof window === 'undefined') return;

  // Evita disparar múltiplos sons idênticos simultaneamente (debouncing de 600ms)
  const now = Date.now();
  if (now - lastPlayTimestamp < 600) {
    return;
  }
  lastPlayTimestamp = now;

  try {
    const isSoundEnabled = localStorage.getItem('asthros-sound-enabled') !== 'false';
    if (!isSoundEnabled) return;

    let targetUrl = soundUrl;
    const savedUrl = localStorage.getItem('asthros-sound-url');

    // Auto-migração: se for o link antigo mixkit.co ou nulo, migra para o Anime WOW
    if (!targetUrl || targetUrl.includes('mixkit.co') || (savedUrl && savedUrl.includes('mixkit.co'))) {
      targetUrl = '/anime-wow-sound-effect-mp3cut.mp3';
      localStorage.setItem('asthros-sound-url', '/anime-wow-sound-effect-mp3cut.mp3');
      localStorage.setItem('asthros-sound-type', 'animewow');
    }

    if (!targetUrl) {
      targetUrl = savedUrl || '/anime-wow-sound-effect-mp3cut.mp3';
    }

    if (targetUrl.startsWith('/')) {
      targetUrl = window.location.origin + targetUrl;
    }

    const audio = getSharedAudio();
    if (audio) {
      audio.src = targetUrl;
      audio.currentTime = 0;
      audio.volume = 1.0;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Aviso de Autoplay do navegador (requer clique prévio na tela):", err);
          // Fallback para novo elemento caso o singleton falhe
          try {
            const fallback = new Audio(targetUrl);
            fallback.volume = 1.0;
            fallback.play().catch(() => {});
          } catch (e) {}
        });
      }
    }
  } catch (err) {
    console.error('Erro ao tocar áudio de notificação:', err);
  }
}
