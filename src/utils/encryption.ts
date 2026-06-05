const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKeyMaterial = enc.encode(secret);
  
  // Utiliza SHA-256 para derivar determinísticamente uma chave de 32 bytes (256 bits)
  const hash = await crypto.subtle.digest('SHA-256', rawKeyMaterial);
  
  return await crypto.subtle.importKey(
    'raw',
    hash,
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(text: string, secret: string): Promise<string> {
  if (!text) return '';
  try {
    const cryptoKey = await getCryptoKey(secret);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv
      },
      cryptoKey,
      enc.encode(text)
    );
    
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const encryptedHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    return `${ivHex}:${encryptedHex}`;
  } catch (e) {
    console.error('Erro na criptografia:', e);
    return text;
  }
}

export async function decrypt(cipherText: string, secret: string): Promise<string> {
  if (!cipherText) return '';
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 2) return cipherText; // Retorna o texto original se não estiver no formato criptografado
    
    const ivHex = parts[0];
    const encryptedHex = parts[1];
    
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    const cryptoKey = await getCryptoKey(secret);
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv
      },
      cryptoKey,
      encrypted
    );
    
    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (e) {
    // Retorna o original em caso de falha de decodificação (dados legados não criptografados)
    return cipherText;
  }
}
