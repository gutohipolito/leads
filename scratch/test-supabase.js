const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    env[key] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('URL:', supabaseUrl);
console.log('Anon Key:', supabaseAnonKey ? 'Found' : 'Not found');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase
    .from('clients')
    .select('*, webhooks(*)')
    .eq('status', 'active');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Result length:', data.length);
    data.forEach(c => {
      console.log(`Client: ${c.name} (${c.id})`);
      console.log(`- status: ${c.status}`);
      console.log(`- webhooks count: ${c.webhooks ? c.webhooks.length : 'undefined/null'}`);
      if (c.webhooks) {
        c.webhooks.forEach(w => {
          console.log(`  * Webhook: ${w.name} - status: ${w.status}`);
        });
      }
    });
  }
}

run();
