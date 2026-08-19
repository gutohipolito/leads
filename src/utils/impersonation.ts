// Cookie que espelha o localStorage 'impersonated_client' para que Server Components
// (que não têm acesso a localStorage) saibam qual cliente um admin está visualizando.
export const IMPERSONATION_COOKIE = 'asthros_impersonated_client';

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export function setImpersonatedClientCookie(client: { id: string; name: string }) {
  if (typeof document === 'undefined') return;
  const value = encodeURIComponent(JSON.stringify({ id: client.id, name: client.name }));
  document.cookie = `${IMPERSONATION_COOKIE}=${value}; path=/; max-age=${THIRTY_DAYS}; SameSite=Lax`;
}

export function clearImpersonatedClientCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${IMPERSONATION_COOKIE}=; path=/; max-age=0`;
}
