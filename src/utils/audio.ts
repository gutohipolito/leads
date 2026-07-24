/**
 * Utilitário para tocar efeitos sonoros com amplificação de volume via Web Audio API GainNode.
 * Permite multiplicar o volume original (ex: gainMultiplier = 3.5 -> 350% do volume original).
 */
export function playBoostedAudio(soundUrl?: string, gainMultiplier: number = 3.5) {
  if (typeof window === 'undefined') return;

  try {
    const isSoundEnabled = localStorage.getItem('asthros-sound-enabled') !== 'false';
    if (!isSoundEnabled) return;

    const urlToPlay = soundUrl || localStorage.getItem('asthros-sound-url') || '/anime-wow-sound-effect-mp3cut.mp3';
    const audio = new Audio(urlToPlay);
    audio.crossOrigin = 'anonymous';
    audio.volume = 1.0;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const source = audioCtx.createMediaElementSource(audio);
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = gainMultiplier; // Amplifica o sinal (ex: 3.5x = +350%)
      
      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      audio.play().catch((err) => {
        // Fallback em caso de restrição de autoplay ou bloqueio no GainNode
        audio.play().catch(() => {});
      });
      return;
    }

    audio.play().catch(() => {});
  } catch (e) {
    try {
      const fallbackAudio = new Audio(soundUrl || '/anime-wow-sound-effect-mp3cut.mp3');
      fallbackAudio.volume = 1.0;
      fallbackAudio.play().catch(() => {});
    } catch (err) {
      console.error('Falha ao reproduzir áudio:', err);
    }
  }
}
