// Mapeamento puro de "quais campos são criptografados" em leads/purchases — sem
// nenhuma lógica de rede ou de chave. Usado tanto pelo client (frontendEncryption.ts,
// que decripta via HTTP) quanto pelo server (serverDecryption.ts, que decripta direto),
// pra essas duas versões nunca divergirem sobre quais campos decriptar.

export interface DecryptionJob {
  target: any;
  key: string;
}

export interface DecryptionMap {
  results: any[];
  jobs: DecryptionJob[];
  values: string[];
}

function registerField(jobs: DecryptionJob[], values: string[], obj: any, key: string) {
  if (obj && typeof obj[key] === 'string' && obj[key]) {
    jobs.push({ target: obj, key });
    values.push(obj[key]);
  }
}

export function mapLeadsForDecryption(leadsList: any[]): DecryptionMap {
  const jobs: DecryptionJob[] = [];
  const values: string[] = [];
  const results = (leadsList || []).map((lead) => ({ ...lead }));

  for (const lead of results) {
    registerField(jobs, values, lead, 'email');
    registerField(jobs, values, lead, 'phone');

    if (lead.data) {
      lead.data = { ...lead.data };
      registerField(jobs, values, lead.data, 'email');
      registerField(jobs, values, lead.data, 'e_mail');
      registerField(jobs, values, lead.data, 'phone');
      registerField(jobs, values, lead.data, 'telefone');
      registerField(jobs, values, lead.data, 'whatsapp');

      if (lead.data.fields) {
        lead.data.fields = { ...lead.data.fields };
        registerField(jobs, values, lead.data.fields, 'email');
        registerField(jobs, values, lead.data.fields, 'e_mail');
        registerField(jobs, values, lead.data.fields, 'phone');
        registerField(jobs, values, lead.data.fields, 'telefone');
      }
    }
  }

  return { results, jobs, values };
}

export function mapPurchasesForDecryption(purchasesList: any[]): DecryptionMap {
  const jobs: DecryptionJob[] = [];
  const values: string[] = [];
  const results = (purchasesList || []).map((purchase) => ({ ...purchase }));

  for (const purchase of results) {
    registerField(jobs, values, purchase, 'customer_email');
    registerField(jobs, values, purchase, 'customer_phone');
  }

  return { results, jobs, values };
}

export function applyDecryptedValues(jobs: DecryptionJob[], decryptedValues: string[]) {
  jobs.forEach((job, i) => {
    job.target[job.key] = decryptedValues[i];
  });
}
