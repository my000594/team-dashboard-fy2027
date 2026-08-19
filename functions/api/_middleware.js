// /api配下だけをCloudflare Accessで保護する（サイト全体は既にAccess（エッジ側）で保護済みだが、
// Cf-Access-Authenticated-User-Emailヘッダーはプレビューデプロイ等Accessを経由しない入口では
// 誰でも偽装できるため、書き込みAPIであるここだけはJWT（Cf-Access-Jwt-Assertion）を自前で検証して
// 信頼できるemailを確定させる）。
//
// npm依存（@cloudflare/pages-plugin-cloudflare-access）を使わずWeb Crypto APIだけで検証している。
// 理由：Cloudflare Pagesはビルドコマンド未設定だとnpm installをスキップするため、依存パッケージを
// 追加すると「Functionsのバンドル時にだけ解決できない」というビルド失敗を起こす（2026-08-19に実際に発生）。
// このリポジトリはフロント（*.html/*.js）同様、Functionsもビルド不要・依存なしで動かす方針にしている。

function base64UrlToBytes(base64Url) {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlToString(base64Url) {
  return new TextDecoder().decode(base64UrlToBytes(base64Url));
}

let cachedJWKS = null;
let cachedJWKSAt = 0;
const JWKS_TTL_MS = 60 * 60 * 1000;

async function getJWKS(teamDomain, forceRefresh) {
  const now = Date.now();
  if (!forceRefresh && cachedJWKS && (now - cachedJWKSAt) < JWKS_TTL_MS) return cachedJWKS;
  const res = await fetch(`${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('failed to fetch Access certs');
  cachedJWKS = await res.json();
  cachedJWKSAt = now;
  return cachedJWKS;
}

async function verifyAccessJWT(token, teamDomain, policyAud) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed JWT');
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = JSON.parse(base64UrlToString(headerB64));
  const payload = JSON.parse(base64UrlToString(payloadB64));

  let jwks = await getJWKS(teamDomain, false);
  let jwk = jwks.keys.find(k => k.kid === header.kid);
  if (!jwk) {
    // 署名鍵のローテーション直後の可能性があるため、キャッシュを1回だけ強制更新して再検索する
    jwks = await getJWKS(teamDomain, true);
    jwk = jwks.keys.find(k => k.kid === header.kid);
    if (!jwk) throw new Error('signing key not found');
  }

  const publicKey = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    base64UrlToBytes(signatureB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );
  if (!isValid) throw new Error('invalid signature');

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && now >= payload.exp) throw new Error('token expired');
  if (payload.iss !== teamDomain) throw new Error('unexpected issuer');
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(policyAud)) throw new Error('unexpected audience');

  return payload;
}

export async function onRequest(context) {
  const token = context.request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return new Response('Unauthorized', { status: 401 });

  try {
    const payload = await verifyAccessJWT(token, context.env.TEAM_DOMAIN, context.env.POLICY_AUD);
    context.data.cloudflareAccess = { JWT: { payload } };
  } catch (e) {
    return new Response('Unauthorized', { status: 401 });
  }

  return context.next();
}
