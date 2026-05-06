import { supabase } from '@/lib/supabase';

export async function logAction(
  action: string, 
  entity?: string, 
  entity_id?: string, 
  details?: any
) {
  const { data: { user } } = await supabase.auth.getUser();
  
  await supabase.from('system_logs').insert([{
    user_id: user?.id,
    action,
    entity,
    entity_id,
    details,
    ip_address: 'browser-client'
  }]);
}
