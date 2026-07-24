/**
 * Utilitário de áudio para notificações de novos leads.
 *
 * ESTRATÉGIA:
 * A Política de Autoplay dos navegadores modernos bloqueia o `.play()` em
 * elementos de áudio criados fora de uma interação do usuário (clique/toque).
 * A solução é pré-carregar o arquivo de som NO MOMENTO do primeiro clique
 * (criando e pausando o elemento nessa interação), então simplesmente chamar
 * `.play()` mais tarde — o navegador reconhece o elemento como "autorizado".
 */

const SOUND_URL = '/anime-wow-sound-effect-mp3cut.mp3';

// Elemento singleton pré-carregado e autorizado pelo navegador
let preloadedAudio: HTMLAudioElement | null = null;
let lastPlayTimestamp = 0;

function getAbsoluteUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  return url.startsWith('/') ? window.location.origin + url : url;
}

function resolveTargetUrl(): string {
  const saved = typeof window !== 'undefined'
    ? localStorage.getItem('asthros-sound-url')
    : null;

  // Se o som salvo for o antigo mixkit, ignora e usa o Anime WOW
  if (!saved || saved.includes('mixkit.co')) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('asthros-sound-url', SOUND_URL);
      localStorage.setItem('asthros-sound-type', 'animewow');
    }
    return getAbsoluteUrl(SOUND_URL);
  }

  return getAbsoluteUrl(saved);
}

/**
 * Pré-carrega e autoriza o elemento de áudio.
 * Deve ser chamado durante uma interação do usuário (clique, toque, tecla).
 */
export function primeAudio() {
  if (typeof window === 'undefined') return;
  if (preloadedAudio) return; // já pronto

  const url = resolveTargetUrl();
  const audio = new Audio(url);
  audio.volume = 0.001; // quase inaudível, só para obter autorização do navegador

  const p = audio.play();
  if (p !== undefined) {
    p.then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1.0;
      preloadedAudio = audio; // armazena o elemento já autorizado
    }).catch(() => {
      // se falhar mesmo assim, guarda o elemento para tentar depois
      preloadedAudio = audio;
    });
  } else {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1.0;
    preloadedAudio = audio;
  }
}

/**
 * Toca o áudio de notificação de novo lead.
 * Se o elemento já foi pré-autorizado (primeAudio foi chamado), toca imediatamente.
 * Caso contrário, tenta criar um novo elemento (pode ser bloqueado pelo navegador).
 */
export function playBoostedAudio(_soundUrl?: string, _gainMultiplier: number = 3.5) {
  if (typeof window === 'undefined') return;

  const isSoundEnabled = localStorage.getItem('asthros-sound-enabled') !== 'false';
  if (!isSoundEnabled) return;

  // Debouncing: evita disparar o mesmo som múltiplas vezes em < 800ms
  const now = Date.now();
  if (now - lastPlayTimestamp < 800) return;
  lastPlayTimestamp = now;

  const url = resolveTargetUrl();

  if (preloadedAudio) {
    // Caminho ideal: element já autorizado, só reinicia e toca
    preloadedAudio.src = url;
    preloadedAudio.currentTime = 0;
    preloadedAudio.volume = 1.0;
    preloadedAudio.play().catch(() => {
      // último recurso
      const fallback = new Audio(url);
      fallback.volume = 1.0;
      fallback.play().catch(() => {});
    });
  } else {
    // Elemento ainda não pré-carregado (usuário não clicou antes)
    // Tenta tocar direto — pode ser bloqueado, mas é o melhor que se pode fazer
    const audio = new Audio(url);
    audio.volume = 1.0;
    audio.play().catch(() => {});
  }
}
