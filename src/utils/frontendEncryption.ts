// A decriptação acontece inteiramente no servidor (/api/security/decrypt) —
// a chave mestra nunca é enviada ao navegador. Antes, todo usuário ativo
// recebia a chave crua, capaz de decriptar os dados de qualquer cliente do
// sistema, não apenas os seus próprios.

let sessionAvailable: boolean | null = null;

async function getAuthToken(): Promise<string | null> {
  const { supabase } = await import('@/lib/supabase');
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Mantido por compatibilidade com os chamadores existentes: indica se há uma
 * sessão autenticada capaz de decriptar dados (não retorna mais a chave em si).
 */
export async function fetchEncryptionKey(): Promise<string | null> {
  if (sessionAvailable !== null) return sessionAvailable ? 'server-managed' : null;
  try {
    const token = await getAuthToken();
    sessionAvailable = !!token;
  } catch (e) {
    console.error('Erro ao verificar sessão de decriptação:', e);
    sessionAvailable = false;
  }
  return sessionAvailable ? 'server-managed' : null;
}

async function decryptBatch(values: string[]): Promise<string[]> {
  try {
    const token = await getAuthToken();
    if (!token) return values;

    const response = await fetch('/api/security/decrypt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ values }),
    });
    if (!response.ok) return values;

    const data = await response.json();
    return Array.isArray(data.values) ? data.values : values;
  } catch (e) {
    console.error('Erro ao decriptar dados:', e);
    return values;
  }
}

export async function decryptLead(lead: any, _key?: string | null): Promise<any> {
  const [decrypted] = await decryptLeadsList([lead]);
  return decrypted;
}

export async function decryptLeadsList(leadsList: any[]): Promise<any[]> {
  if (!leadsList || leadsList.length === 0) return leadsList;

  const jobs: Array<{ target: any; key: string }> = [];
  const values: string[] = [];

  const registerField = (obj: any, key: string) => {
    if (obj && typeof obj[key] === 'string' && obj[key]) {
      jobs.push({ target: obj, key });
      values.push(obj[key]);
    }
  };

  const results = leadsList.map((lead) => ({ ...lead }));

  for (const lead of results) {
    registerField(lead, 'email');
    registerField(lead, 'phone');

    if (lead.data) {
      lead.data = { ...lead.data };
      registerField(lead.data, 'email');
      registerField(lead.data, 'e_mail');
      registerField(lead.data, 'phone');
      registerField(lead.data, 'telefone');
      registerField(lead.data, 'whatsapp');

      if (lead.data.fields) {
        lead.data.fields = { ...lead.data.fields };
        registerField(lead.data.fields, 'email');
        registerField(lead.data.fields, 'e_mail');
        registerField(lead.data.fields, 'phone');
        registerField(lead.data.fields, 'telefone');
      }
    }
  }

  if (values.length === 0) return results;

  const decryptedValues = await decryptBatch(values);
  jobs.forEach((job, i) => {
    job.target[job.key] = decryptedValues[i];
  });

  return results;
}

export async function decryptPurchase(purchase: any, _key?: string | null): Promise<any> {
  const [decrypted] = await decryptPurchasesList([purchase]);
  return decrypted;
}

export async function decryptPurchasesList(purchasesList: any[]): Promise<any[]> {
  if (!purchasesList || purchasesList.length === 0) return purchasesList;

  const jobs: Array<{ target: any; key: string }> = [];
  const values: string[] = [];
  const results = purchasesList.map((purchase) => ({ ...purchase }));

  const registerField = (obj: any, key: string) => {
    if (obj && typeof obj[key] === 'string' && obj[key]) {
      jobs.push({ target: obj, key });
      values.push(obj[key]);
    }
  };

  for (const purchase of results) {
    registerField(purchase, 'customer_email');
    registerField(purchase, 'customer_phone');
  }

  if (values.length === 0) return results;

  const decryptedValues = await decryptBatch(values);
  jobs.forEach((job, i) => {
    job.target[job.key] = decryptedValues[i];
  });

  return results;
}
