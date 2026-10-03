import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname;

  let role: string | null = null;
  if (user) {
    // Edge-compatible admin client
    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: userRecord } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single();
    role = userRecord?.role || null;
  }

  // Exclude login routes
  const isAuthRoute = pathname === '/login' || pathname === '/signup' || pathname === '/admin/login' || pathname === '/doctor/login' || pathname === '/patient/login';

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = role === 'admin' ? '/admin/dashboard' : role ? `/${role}/dashboard` : '/'
    return NextResponse.redirect(url)
  }

  // Protection maps
  const protectedRoutes = [
    { prefix: '/admin', roles: ['admin'], loginUrl: '/admin/login' },
    { prefix: '/doctor', roles: ['doctor'], loginUrl: '/doctor/login' },
    { prefix: '/compounder', roles: ['compounder'], loginUrl: '/login' },
    { prefix: '/patient', roles: ['patient'], loginUrl: '/patient/login' },
  ];

  for (const route of protectedRoutes) {
    if (pathname.startsWith(route.prefix) && !isAuthRoute) {
      if (!user) {
        const url = request.nextUrl.clone()
        url.pathname = route.loginUrl
        return NextResponse.redirect(url)
      }
      if (role && !route.roles.includes(role)) {
        const url = request.nextUrl.clone()
        url.pathname = role === 'admin' ? '/admin/dashboard' : `/${role}/dashboard`
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
