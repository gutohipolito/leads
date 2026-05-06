import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Criamos o cliente do navegador que gerencia cookies automaticamente para o Next.js
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
