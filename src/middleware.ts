import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Se as variáveis estiverem ausentes, não conseguimos checar auth, então deixamos passar
    if (!supabaseUrl || !supabaseAnonKey) {
      return response
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

    const { data: { user } } = await supabase.auth.getUser()

    // Lógica de proteção de rotas
    const isLoginPage = request.nextUrl.pathname.startsWith('/login')
    const isApiRoute = request.nextUrl.pathname.startsWith('/api')
    const isPublicAsset = request.nextUrl.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|mp4|js)$/)
    const isTracker = request.nextUrl.pathname === '/tracker.js' || request.nextUrl.pathname === '/tracker.min.js'

    if (isPublicAsset || isApiRoute || isTracker) {
      return response
    }

    // Se NÃO tem usuário e NÃO está na login -> Vai para login
    if (!user && !isLoginPage) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Se TEM usuário e ESTÁ na login -> Vai para a home
    if (user && isLoginPage) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    return response
  } catch (e) {
    // Falha silenciosa para evitar erro 500 em produção
    return response
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
