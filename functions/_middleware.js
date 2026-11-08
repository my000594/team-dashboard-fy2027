// サイト全体の配信許可リスト（2026-11-08追加）。
// Cloudflare Pagesはリポジトリの中身をすべて配信するため、何もしないと docs/（マニュアル・ヒアリングシート）・
// CLAUDE.md・scripts/・.claude/・*.bat などもURL直打ちで取得できてしまう（Access認証の内側ではあるが、
// 部下に必要なのはダッシュボードの表示に使うファイルだけ）。ここに載っていないパスはすべて404を返す。
//
// ★ 新しいページ・共通スクリプトを追加したら、下の PAGES / FILES に追記すること。
//   追記を忘れるとそのページは本番で404になる（scripts/check-consistency.mjs が全 *.html の記載漏れを検出する）。
//
// /api/ 配下はこの後に functions/api/_middleware.js（JWT検証）が実行される。
// 依存なし・ビルド不要（functions/api/_middleware.js と同じ方針）。

// ルート直下のページ（拡張子なし。Pagesは /xxx.html を /xxx へリダイレクトするので両方許可する）
const PAGES = [
  'index', 'info', 'member', 'reports', 'sales', 'knowledge', 'meetings', 'skill',
  'career', 'chronicle', 'portfolio', 'maintenance-app',
];

// ページ以外で配信してよい個別ファイル
const FILES = [
  '/style.css', '/nav.js', '/md.js', '/data.js', '/you-widget.js',
  '/robots.txt', '/config/org.json',
];

const PAGE_PATHS = new Set(['/', ...PAGES.flatMap((p) => [`/${p}`, `/${p}.html`])]);
const FILE_PATHS = new Set(FILES);

function isAllowed(pathname) {
  if (PAGE_PATHS.has(pathname) || FILE_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/api/')) return true;
  // data/ 配下：CSV・maintenance.json・顔写真・ナレッジ画像。開発メモの data/CLAUDE.md 等の .md は除く
  if (pathname.startsWith('/data/') && !/\.md$/i.test(pathname)) return true;
  return false;
}

export async function onRequest(context) {
  // URLパーサが ".." や "%2e%2e" を正規化した後のパスで判定する
  const { pathname } = new URL(context.request.url);
  if (isAllowed(pathname)) return context.next();
  return new Response('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}
