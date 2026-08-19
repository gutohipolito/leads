import { decrypt } from './encryption';
import { mapLeadsForDecryption, mapPurchasesForDecryption, applyDecryptedValues } from './leadDecryption';

// Mesma lógica de /api/security/decrypt, mas chamada direto em Server Components —
// evita o round-trip HTTP do próprio servidor pra ele mesmo no primeiro carregamento
// de uma página.
function getEncryptionSecret(): string {
  return process.env.LEADS_ENCRYPTION_KEY || 'asthros-default-secret-encryption-key-value-991823901';
}

async function decryptBatchServer(values: string[]): Promise<string[]> {
  const secret = getEncryptionSecret();
  return Promise.all(values.map((v) => (v ? decrypt(v, secret) : v)));
}

export async function decryptLeadsListServer(leadsList: any[]): Promise<any[]> {
  if (!leadsList || leadsList.length === 0) return leadsList;

  const { results, jobs, values } = mapLeadsForDecryption(leadsList);
  if (values.length === 0) return results;

  const decryptedValues = await decryptBatchServer(values);
  applyDecryptedValues(jobs, decryptedValues);

  return results;
}

export async function decryptPurchasesListServer(purchasesList: any[]): Promise<any[]> {
  if (!purchasesList || purchasesList.length === 0) return purchasesList;

  const { results, jobs, values } = mapPurchasesForDecryption(purchasesList);
  if (values.length === 0) return results;

  const decryptedValues = await decryptBatchServer(values);
  applyDecryptedValues(jobs, decryptedValues);

  return results;
}
