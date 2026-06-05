import { decrypt } from './encryption';

let cachedKey: string | null = null;

export async function fetchEncryptionKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;

    const response = await fetch('/api/security/encryption-key', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (response.ok) {
      const data = await response.json();
      cachedKey = data.encryptionKey || null;
      return cachedKey;
    }
  } catch (e) {
    console.error('Erro ao buscar chave de criptografia:', e);
  }
  return null;
}

export async function decryptLead(lead: any, key: string): Promise<any> {
  if (!lead) return lead;
  
  const decryptedEmail = lead.email ? await decrypt(lead.email, key) : lead.email;
  const decryptedPhone = lead.phone ? await decrypt(lead.phone, key) : lead.phone;
  
  let data = lead.data;
  if (data) {
    data = { ...data };
    
    const decryptKeyIfExists = async (obj: any, k: string) => {
      if (obj && obj[k] && typeof obj[k] === 'string') {
        obj[k] = await decrypt(obj[k], key);
      }
    };

    await decryptKeyIfExists(data, 'email');
    await decryptKeyIfExists(data, 'e_mail');
    await decryptKeyIfExists(data, 'phone');
    await decryptKeyIfExists(data, 'telefone');
    await decryptKeyIfExists(data, 'whatsapp');
    
    if (data.fields) {
      data.fields = { ...data.fields };
      await decryptKeyIfExists(data.fields, 'email');
      await decryptKeyIfExists(data.fields, 'e_mail');
      await decryptKeyIfExists(data.fields, 'phone');
      await decryptKeyIfExists(data.fields, 'telefone');
    }
  }

  return {
    ...lead,
    email: decryptedEmail,
    phone: decryptedPhone,
    data
  };
}

export async function decryptLeadsList(leadsList: any[]): Promise<any[]> {
  const key = await fetchEncryptionKey();
  if (!key) {
    return leadsList;
  }
  
  return await Promise.all(leadsList.map(lead => decryptLead(lead, key)));
}
