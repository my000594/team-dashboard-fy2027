// ナレッジ👍投票API。データはNotion同期とは無関係にD1（votesテーブル）だけで完結する。
// item_key はナレッジ項目のタイトル文字列そのもの（knowledge.csvの「親ナレッジ」列と同じくタイトル一致に依存する既存方式に合わせている）。
// 本人特定はfunctions/api/_middleware.jsが検証したAccess JWTのemailクレームを使う（ヘッダーを直接は信用しない）。

function voterEmail(context) {
  return context.data?.cloudflareAccess?.JWT?.payload?.email || null;
}

export async function onRequestGet(context) {
  const email = voterEmail(context);
  if (!email) return new Response('Unauthorized', { status: 401 });

  const { env } = context;
  const countsResult = await env.DB.prepare(
    'SELECT item_key, COUNT(*) AS cnt FROM votes GROUP BY item_key'
  ).all();
  const counts = {};
  for (const row of countsResult.results) counts[row.item_key] = row.cnt;

  const mineResult = await env.DB.prepare(
    'SELECT item_key FROM votes WHERE voter_email = ?'
  ).bind(email).all();
  const mine = mineResult.results.map(r => r.item_key);

  return Response.json({ counts, mine });
}

export async function onRequestPost(context) {
  const email = voterEmail(context);
  if (!email) return new Response('Unauthorized', { status: 401 });

  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
  const itemKey = String(body?.itemKey || '').trim();
  if (!itemKey) return new Response('Bad Request', { status: 400 });

  const { env } = context;
  const existing = await env.DB.prepare(
    'SELECT 1 FROM votes WHERE item_key = ? AND voter_email = ?'
  ).bind(itemKey, email).first();

  let voted;
  if (existing) {
    await env.DB.prepare(
      'DELETE FROM votes WHERE item_key = ? AND voter_email = ?'
    ).bind(itemKey, email).run();
    voted = false;
  } else {
    await env.DB.prepare(
      'INSERT INTO votes (item_key, voter_email, created_at) VALUES (?, ?, ?)'
    ).bind(itemKey, email, new Date().toISOString()).run();
    voted = true;
  }

  const countRow = await env.DB.prepare(
    'SELECT COUNT(*) AS cnt FROM votes WHERE item_key = ?'
  ).bind(itemKey).first();

  return Response.json({ voted, count: countRow.cnt });
}
