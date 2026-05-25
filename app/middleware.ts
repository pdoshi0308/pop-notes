import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_DASHBOARD_PATHS = [
  '/dashboard/login',
  '/dashboard/forgot',
  '/dashboard/reset',
  '/dashboard/accept-invite',
];

const MEMBER_ALLOWED_PATHS = ['/dashboard', '/dashboard/account'];

function isPublicDashboardPath(pathname: string): boolean {
  return PUBLIC_DASHBOARD_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function isMemberAllowedPath(pathname: string): boolean {
  return MEMBER_ALLOWED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  const res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(items) {
          items.forEach(({ name, value, options }) => {
            res.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (isPublicDashboardPath(pathname)) {
    if (user && pathname === '/dashboard/login') {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return res;
  }

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (!isMemberAllowedPath(pathname)) {
    const { data: profile } = await supabase
      .from('users')
      .select('role, workspace_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.workspace_id) {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard/login';
      url.search = '?error=no_workspace';
      return NextResponse.redirect(url);
    }

    if (profile.role !== 'admin') {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
