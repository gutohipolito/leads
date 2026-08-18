import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { decrypt } from '@/utils/encryption';

const MAX_VALUES_PER_REQUEST = 5000;

async function getActiveUser(request: NextRequest) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return null;

  const { data: profile } = await supabase
    .from('system_users')
    .select('status')
    .eq('email', user.email)
    .single();

  if (!profile || profile.status !== 'active') return null;
  return user;
}

/**
 * Decripta valores no servidor. A chave mestra (LEADS_ENCRYPTION_KEY) nunca
 * sai do backend — substitui o antigo endpoint que devolvia a chave crua
 * para qualquer usuário ativo, permitindo que decriptasse dados de qualquer
 * cliente do sistema, não só os seus próprios.
 */
export async function POST(request: NextRequest) {
  const user = await getActiveUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const values: unknown[] = Array.isArray(body?.values) ? body.values : [];
  if (values.length === 0) {
    return NextResponse.json({ values: [] });
  }
  if (values.length > MAX_VALUES_PER_REQUEST) {
    return NextResponse.json({ error: 'Muitos valores em uma única requisição.' }, { status: 400 });
  }

  const encryptionSecret = process.env.LEADS_ENCRYPTION_KEY || 'asthros-default-secret-encryption-key-value-991823901';

  const decryptedValues = await Promise.all(
    values.map((v) => (typeof v === 'string' && v ? decrypt(v, encryptionSecret) : v))
  );

  return NextResponse.json({ values: decryptedValues });
}
