/**
 * Utilitário para tocar efeitos sonoros de notificação de novos leads.
 * Realiza auto-migração de links antigos (mixkit) para o novo som /anime-wow-sound-effect-mp3cut.mp3
 * e garante a execução sem bloqueios de CORS ou Web Audio API.
 */
export function playBoostedAudio(soundUrl?: string, gainMultiplier: number = 3.5) {
  if (typeof window === 'undefined') return;

  try {
    const isSoundEnabled = localStorage.getItem('asthros-sound-enabled') !== 'false';
    if (!isSoundEnabled) return;

    let targetUrl = soundUrl;
    const savedUrl = localStorage.getItem('asthros-sound-url');

    // Auto-migração: Se não houver som definido ou for o link antigo do mixkit, altera para o Anime WOW
    if (!targetUrl || targetUrl.includes('mixkit.co') || (savedUrl && savedUrl.includes('mixkit.co'))) {
      targetUrl = '/anime-wow-sound-effect-mp3cut.mp3';
      localStorage.setItem('asthros-sound-url', '/anime-wow-sound-effect-mp3cut.mp3');
      localStorage.setItem('asthros-sound-type', 'animewow');
    }

    if (!targetUrl) {
      targetUrl = savedUrl || '/anime-wow-sound-effect-mp3cut.mp3';
    }

    // 1. Toca via HTML5 Audio a 100% de volume (Garantia de compatibilidade sem erros de CORS)
    const primaryAudio = new Audio(targetUrl);
    primaryAudio.volume = 1.0;
    
    const playPromise = primaryAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn("Aviso de Autoplay: O áudio tocará assim que houver interação do usuário na página.", err);
      });
    }

    // 2. Se a Web Audio API estiver ativa e desbloqueada, aplica amplificação extra com GainNode
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        if (audioCtx.state === 'running') {
          const boostedAudio = new Audio(targetUrl);
          boostedAudio.volume = 1.0;
          const source = audioCtx.createMediaElementSource(boostedAudio);
          const gainNode = audioCtx.createGain();
          gainNode.gain.value = gainMultiplier;
          source.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          boostedAudio.play().catch(() => {});
        }
      }
    } catch (e) {
      // Caso o Web Audio API não consiga criar o node, o primaryAudio já está tocando
    }

  } catch (err) {
    console.error('Erro ao tocar áudio de notificação:', err);
  }
}
