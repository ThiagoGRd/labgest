import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const caminho = request.nextUrl.pathname
  const rotaPublica = caminho.startsWith('/login') || caminho.startsWith('/auth') || caminho.startsWith('/check/')

  if (!user && !rotaPublica) return NextResponse.redirect(new URL('/login', request.url))
  if (user && caminho.startsWith('/login')) return NextResponse.redirect(new URL('/dashboard', request.url))
  if (caminho === '/') return NextResponse.redirect(new URL(user ? '/dashboard' : '/login', request.url))
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
