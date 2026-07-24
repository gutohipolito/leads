/**
 * Utilitário para tocar efeitos sonoros de notificação de novos leads.
 * Inclui desbloqueador global de áudio no primeiro clique do usuário (Autoplay Policy),
 * auto-migração de links antigos no localStorage e resolução absoluta da URL.
 */

// Desbloqueia a política de Autoplay do navegador no primeiro clique/interação do usuário na página
if (typeof window !== 'undefined') {
  const unlockAudioContext = () => {
    try {
      const silentAudio = new Audio();
      silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      silentAudio.volume = 0.01;
      silentAudio.play().then(() => {
        silentAudio.pause();
      }).catch(() => {});
    } catch (e) {}

    window.removeEventListener('click', unlockAudioContext);
    window.removeEventListener('keydown', unlockAudioContext);
    window.removeEventListener('touchstart', unlockAudioContext);
  };

  window.addEventListener('click', unlockAudioContext, { once: true });
  window.addEventListener('keydown', unlockAudioContext, { once: true });
  window.addEventListener('touchstart', unlockAudioContext, { once: true });
}

export function playBoostedAudio(soundUrl?: string, gainMultiplier: number = 3.5) {
  if (typeof window === 'undefined') return;

  try {
    const isSoundEnabled = localStorage.getItem('asthros-sound-enabled') !== 'false';
    if (!isSoundEnabled) return;

    let targetUrl = soundUrl;
    const savedUrl = localStorage.getItem('asthros-sound-url');

    // Auto-migração: Se for link antigo do mixkit ou não houver som, migra para o Anime WOW
    if (!targetUrl || targetUrl.includes('mixkit.co') || (savedUrl && savedUrl.includes('mixkit.co'))) {
      targetUrl = '/anime-wow-sound-effect-mp3cut.mp3';
      localStorage.setItem('asthros-sound-url', '/anime-wow-sound-effect-mp3cut.mp3');
      localStorage.setItem('asthros-sound-type', 'animewow');
    }

    if (!targetUrl) {
      targetUrl = savedUrl || '/anime-wow-sound-effect-mp3cut.mp3';
    }

    // Resolve a URL de forma absoluta para garantir que rotas secundárias (ex: /admin/live) encontrem o arquivo na raiz
    if (targetUrl.startsWith('/')) {
      targetUrl = window.location.origin + targetUrl;
    }

    // Toca via HTML5 Audio a 100% de volume
    const audio = new Audio(targetUrl);
    audio.volume = 1.0;
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn("Aviso de Autoplay: Áudio aguardando primeira interação do usuário.", err);
      });
    }

  } catch (err) {
    console.error('Erro ao tocar áudio de notificação:', err);
  }
}
