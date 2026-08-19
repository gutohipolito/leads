import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { IMPERSONATION_COOKIE } from '@/utils/impersonation';

export interface ViewerContext {
  userId: string;
  email: string;
  isAdmin: boolean;
  /** Cliente ativo: o próprio cliente do usuário, ou o cliente impersonado (admin). */
  activeClientId: string | null;
  /** Nome do cliente impersonado, só preenchido quando um admin está "entrando como" um cliente. */
  impersonatedName: string | null;
}

/**
 * Resolve quem é o usuário autenticado (role, client_id, impersonação) no servidor.
 * Autorização (isAdmin) sempre vem do banco — o cookie de impersonação só informa
 * qual cliente um admin escolheu visualizar, nunca concede privilégio nenhum.
 */
export async function getViewerContext(): Promise<ViewerContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return null;

  const { data: profile } = await supabase
    .from('system_users')
    .select('role, client_id')
    .eq('email', user.email)
    .single();

  const isAdmin = profile?.role === 'admin';

  let impersonated: { id: string; name: string } | null = null;
  if (isAdmin) {
    const cookieStore = await cookies();
    const raw = cookieStore.get(IMPERSONATION_COOKIE)?.value;
    if (raw) {
      try {
        impersonated = JSON.parse(decodeURIComponent(raw));
      } catch {
        impersonated = null;
      }
    }
  }

  return {
    userId: user.id,
    email: user.email,
    isAdmin,
    activeClientId: impersonated ? impersonated.id : (profile?.client_id ?? null),
    impersonatedName: impersonated ? impersonated.name : null,
  };
}
