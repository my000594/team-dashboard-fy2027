// Cloudflare Pages Functions: サイト全体（data/配下のCSVも含む）にBasic認証をかける。
// ID・パスワードはリポジトリに含めず、Cloudflare Pagesの環境変数 DASH_USER / DASH_PASS で管理する
// （Cloudflareダッシュボード → Pagesプロジェクト → Settings → Environment variables）。
// 未設定の場合は誤って無認証公開してしまわないよう、全リクエストを503でブロックする。

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

function unauthorized() {
  return new Response('認証が必要です', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="team-dashboard-fy2027", charset="UTF-8"' },
  });
}

export async function onRequest({ request, next, env }) {
  const expectedUser = env.DASH_USER;
  const expectedPass = env.DASH_PASS;

  if (!expectedUser || !expectedPass) {
    return new Response('DASH_USER / DASH_PASS が未設定です。Cloudflare Pagesの環境変数を設定してください。', { status: 503 });
  }

  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Basic ')) {
    let decoded = '';
    try {
      decoded = atob(auth.slice(6));
    } catch {
      return unauthorized();
    }
    const idx = decoded.indexOf(':');
    const user = idx >= 0 ? decoded.slice(0, idx) : decoded;
    const pass = idx >= 0 ? decoded.slice(idx + 1) : '';
    if (timingSafeEqual(user, expectedUser) && timingSafeEqual(pass, expectedPass)) {
      return next();
    }
  }
  return unauthorized();
}
