import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Força que a API seja sempre processada de forma dinâmica
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Obter monitores de uptime cadastrados
    const { data: monitors, error } = await supabase
      .from('uptime_monitors')
      .select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!monitors || monitors.length === 0) {
      return NextResponse.json({ message: 'Nenhum monitor cadastrado.' });
    }

    // 2. Disparar pings em paralelo para todas as URLs
    const pingPromises = monitors.map(async (monitor) => {
      const startTime = Date.now();
      let status: 'online' | 'offline' = 'offline';
      let responseTimeMs = 0;
      let statusCode: number | null = null;
      let errorMessage: string | null = null;

      try {
        // Envia uma requisição HTTP GET rápida com timeout de 6 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(monitor.url, {
          method: 'GET',
          headers: {
            'User-Agent': 'AsthrosUptimeBot/1.0',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          signal: controller.signal,
          next: { revalidate: 0 } // Desativa o cache do Next.js
        });

        clearTimeout(timeoutId);
        
        responseTimeMs = Date.now() - startTime;
        statusCode = response.status;

        if (response.ok) {
          status = 'online';
        } else {
          status = 'offline';
          errorMessage = `HTTP Status ${response.status}`;
        }
      } catch (err: any) {
        responseTimeMs = Date.now() - startTime;
        status = 'offline';
        errorMessage = err.name === 'AbortError' ? 'Timeout (6s)' : (err.message || 'Erro de rede');
      }

      // Salva log de histórico
      await supabase.from('uptime_logs').insert({
        monitor_id: monitor.id,
        status_code: statusCode,
        response_time_ms: responseTimeMs,
        is_up: status === 'online',
        error_message: errorMessage
      });

      // Atualiza monitor principal
      await supabase
        .from('uptime_monitors')
        .update({
          status: status,
          last_ping_ms: responseTimeMs,
          last_checked: new Date().toISOString()
        })
        .eq('id', monitor.id);

      return {
        id: monitor.id,
        url: monitor.url,
        status,
        responseTimeMs,
        errorMessage
      };
    });

    const results = await Promise.all(pingPromises);

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
