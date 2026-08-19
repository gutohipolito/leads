import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getViewerContext } from '@/lib/viewerContext';
import { decryptLeadsListServer } from '@/utils/serverDecryption';
import HomeClient from './HomeClient';

export default async function Home() {
  const ctx = await getViewerContext();
  if (!ctx) redirect('/login'); // rede de segurança; middleware já garante sessão

  const supabase = await createClient();
  const isFullAdminView = ctx.isAdmin && !ctx.impersonatedName;

  // As três queries abaixo são independentes entre si — disparam em paralelo em
  // vez de esperar uma pela outra, evitando um waterfall sequencial.
  const dataLimite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const clientsCountPromise = isFullAdminView
    ? supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active')
    : Promise.resolve({ count: 0 });

  let leadsQuery = supabase
    .from('leads')
    .select('*, clients(name), webhooks(name)')
    .neq('source', 'test_simulation')
    .gte('created_at', dataLimite)
    .order('created_at', { ascending: false });
  if (!isFullAdminView) {
    leadsQuery = leadsQuery.eq('client_id', ctx.activeClientId);
  }

  let purchasesQuery = supabase
    .from('purchases')
    .select('*, clients(name)')
    .gte('created_at', dataLimite)
    .order('created_at', { ascending: false });
  if (!isFullAdminView) {
    purchasesQuery = purchasesQuery.eq('client_id', ctx.activeClientId);
  }

  const [{ count }, { data: leadsRaw }, { data: purchasesRaw }] = await Promise.all([
    clientsCountPromise,
    leadsQuery,
    purchasesQuery,
  ]);

  const initialLeads = await decryptLeadsListServer(leadsRaw || []);

  return (
    <HomeClient
      initialLeads={initialLeads}
      initialPurchases={purchasesRaw || []}
      isAdmin={ctx.isAdmin}
      activeClientId={ctx.activeClientId}
      impersonatedName={ctx.impersonatedName}
      activeClientsCount={count || 0}
    />
  );
}
