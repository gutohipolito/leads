import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Limite de tempo para a checagem de sessão no Supabase. Se a chamada travar
// (ex: instabilidade momentânea do Supabase Auth), falha rápido em vez de
// deixar a Vercel matar a invocação inteira do middleware com 504
// MIDDLEWARE_INVOCATION_TIMEOUT — o catch abaixo já nega o acesso por segurança.
const AUTH_CHECK_TIMEOUT_MS = 5000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout de ${ms}ms excedido`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

function isUnauthenticatedPublicPath(pathname: string) {
  return (
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/api/leads') ||
    pathname.startsWith('/api/uptime') ||
    pathname === '/tracker.js' ||
    pathname === '/tracker.min.js' ||
    pathname === '/ping'
  )
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Webhooks de loja (Woo/Shopify/Yampi) não podem passar pelo login — senão o WooCommerce recebe 401
  if (isUnauthenticatedPublicPath(pathname) && request.method !== 'OPTIONS') {
    return NextResponse.next()
  }

  // Interceptar e responder imediatamente a requisições de preflight CORS (OPTIONS)
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin')
    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, X-Asthros-Secret, X-Asthros-Webhook-Id, Authorization, X-Shopify-Topic, X-Shopify-Hmac-Sha256, X-Shopify-Shop-Domain, X-WC-Webhook-Topic, X-WC-Webhook-Signature, X-WC-Webhook-Source, X-Yampi-Hmac-Sha256',
      'Access-Control-Allow-Credentials': 'true',
    }
    if (origin && origin !== '*') {
      headers['Access-Control-Allow-Origin'] = origin
    }
    return new NextResponse(null, {
      status: 204,
      headers,
    })
  }

  const isLoginPage = pathname.startsWith('/login')
  const isPublicApi = isUnauthenticatedPublicPath(pathname)
  const isInternalApi = pathname.startsWith('/api') && !isPublicApi

  // Nega o acesso com segurança quando a autenticação não pôde ser verificada
  // (em vez de liberar a requisição sem checagem nenhuma).
  const denyAccess = () => {
    if (isInternalApi) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    if (isLoginPage) {
      // Já está na página de login: apenas segue sem sessão, sem redirecionar.
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Se as variáveis estiverem ausentes, não conseguimos checar auth: nega por segurança.
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[Middleware] Variáveis do Supabase ausentes — acesso negado por segurança.')
      return denyAccess()
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value,
              ...options,
            })
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            })
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    const { data: { user } } = await withTimeout(supabase.auth.getUser(), AUTH_CHECK_TIMEOUT_MS)

    // Lógica de proteção de rotas
    const isPublicAsset = pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|mp4|js)$/)

    // 1. Assets públicos e webhooks externos são liberados
    if (isPublicAsset || isPublicApi) {
      return response
    }

    // 2. Se NÃO tem usuário e NÃO está na login -> Bloqueia acesso (incluindo APIs internas)
    if (!user && !isLoginPage) {
      return denyAccess()
    }

    // 3. Se TEM usuário e ESTÁ na login -> Vai para a home
    if (user && isLoginPage) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    return response
  } catch (e) {
    // Falha ao verificar sessão: nega por segurança em vez de liberar sem checagem.
    console.error('[Middleware] Erro ao verificar sessão — acesso negado por segurança:', e)
    return denyAccess()
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/leads|api/uptime).*)',
  ],
}
