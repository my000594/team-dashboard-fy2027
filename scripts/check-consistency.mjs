// 複数ファイルに重複定義されている値・守るべき約束事の整合性をチェックする（依存なし・ビルド不要）。
// 実行: node scripts/check-consistency.mjs
// 問題があれば一覧を出して終了コード1、無ければ「OK」を出して0で終わる。
// チェック項目を追加・変更したら docs/dev/operations.md の「整合性チェック」節も更新すること。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const problems = [];
const ng = (msg) => problems.push(msg);

// 文字列配列リテラル ['a','b'] を配列にする
const parseArr = (s) => [...s.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 404.html はCloudflare Pagesが存在しないパスに返す専用ページで、ナビ・開発ドキュメント・配信許可リストの対象外
const htmlPages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && f !== '404.html').sort();

// 1. スキル評価時期：config/org.json の skillPeriods を正として、各所のハードコードと一致するか
{
  const master = JSON.parse(read('config/org.json')).skillPeriods;
  const targets = [
    ['skill.html', /let PERIODS = (\[[^\]]*\])/g],
    ['skill.html', /cfg\.skillPeriods\) \|\| (\[[^\]]*\])/g],
    ['portfolio.html', /const PERIODS = (\[[^\]]*\])/g],
    ['you-widget.js', /YOU_SKILL_PERIODS = (\[[^\]]*\])/g],
    ['scripts/sync-notion.mjs', /SKILL_PERIODS = (\[[^\]]*\])/g],
  ];
  for (const [file, re] of targets) {
    const found = [...read(file).matchAll(re)];
    if (found.length === 0) ng(`[評価時期] ${file}: 定義が見つからない（変数名が変わった？チェック側の正規表現を直すこと）`);
    for (const m of found) {
      const arr = parseArr(m[1]);
      if (!same(arr, master)) ng(`[評価時期] ${file}: ${JSON.stringify(arr)} ≠ config/org.json ${JSON.stringify(master)}`);
    }
  }
}

// 2. NEW_BADGE_DAYS：index.html と info.html で同じ値か
{
  const val = (f) => (read(f).match(/const NEW_BADGE_DAYS = (\d+)/) || [])[1];
  const a = val('index.html'), b = val('info.html');
  if (!a || !b) ng('[NEW_BADGE_DAYS] index.html / info.html のどちらかで定義が見つからない');
  else if (a !== b) ng(`[NEW_BADGE_DAYS] index.html=${a} / info.html=${b} が不一致`);
}

// 3. nav.js：NAV_ITEMS の全項目に mini（モバイル用短縮ラベル）があり、リンク先が実在するか
{
  const nav = read('nav.js');
  for (const line of nav.split('\n').filter((l) => /^\s*\{\s*href:/.test(l))) {
    const href = (line.match(/href:\s*'([^']+)'/) || [])[1];
    if (!/mini:\s*'[^']+'/.test(line)) ng(`[nav.js] ${href}: mini（短縮ラベル）が無い`);
    if (href && !exists(href)) ng(`[nav.js] ${href}: ファイルが存在しない`);
  }
}

// 4. 開発ドキュメント：全ページに docs/dev/pages/<名前>.md があり、ルートCLAUDE.mdの索引が指すファイルが実在するか
{
  for (const f of htmlPages) {
    const doc = `docs/dev/pages/${f.replace(/\.html$/, '')}.md`;
    if (!exists(doc)) ng(`[開発ドキュメント] ${f}: ${doc} が無い`);
  }
  for (const m of read('CLAUDE.md').matchAll(/`(docs\/dev\/[^`<>*]+\.md)`/g)) {
    if (!exists(m[1])) ng(`[開発ドキュメント] CLAUDE.md が参照する ${m[1]} が存在しない`);
  }
}

// 5. 全ページ共通の約束事：robots noindex、CDNスクリプトのSRI、同じURLなら同じintegrity
{
  const sriByUrl = new Map();
  for (const f of htmlPages) {
    const html = read(f);
    if (!/<meta name="robots" content="noindex/.test(html)) ng(`[robots] ${f}: noindex の meta が無い`);
    for (const tag of html.match(/<script[^>]+src="https?:\/\/[^"]+"[^>]*>/g) || []) {
      const url = tag.match(/src="([^"]+)"/)[1];
      const integ = (tag.match(/integrity="([^"]+)"/) || [])[1];
      if (!integ) { ng(`[SRI] ${f}: ${url} に integrity が無い`); continue; }
      if (!/crossorigin=/.test(tag)) ng(`[SRI] ${f}: ${url} に crossorigin が無い`);
      if (sriByUrl.has(url) && sriByUrl.get(url).integ !== integ) {
        ng(`[SRI] ${url}: ${f} と ${sriByUrl.get(url).file} で integrity が違う`);
      } else if (!sriByUrl.has(url)) sriByUrl.set(url, { integ, file: f });
    }
  }
}

// 6. you-widget.js を読むページは data.js をその前に読んでいるか（fetchCSVText に依存するため）
{
  for (const f of htmlPages) {
    const html = read(f);
    const w = html.indexOf('src="you-widget.js"');
    if (w === -1) continue;
    const d = html.indexOf('src="data.js"');
    if (d === -1 || d > w) ng(`[you-widget] ${f}: data.js が you-widget.js より前に読み込まれていない`);
    if (!html.includes('id="youMini"')) ng(`[you-widget] ${f}: you-widget.js を読んでいるが #youMini が無い`);
  }
}

// 7. 配信許可リスト（functions/_middleware.js）：全ページ・各ページが読む同一オリジンのJS/CSSが載っているか
//    載っていないと本番でそのファイルだけ404になる
{
  const mw = read('functions/_middleware.js');
  const list = (name) => parseArr((mw.match(new RegExp(`const ${name} = (\\[[^\\]]*\\])`)) || [, ''])[1]);
  const pages = list('PAGES'), files = list('FILES');
  if (!pages.length || !files.length) ng('[配信許可] functions/_middleware.js の PAGES / FILES が読み取れない');
  for (const f of htmlPages) {
    if (!pages.includes(f.replace(/\.html$/, ''))) ng(`[配信許可] ${f}: functions/_middleware.js の PAGES に無い（本番で404になる）`);
    for (const m of read(f).matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+\.(?:js|css))"/g)) {
      const ref = m[1];
      if (/^(https?:)?\/\//.test(ref)) continue;
      if (!files.includes('/' + ref.replace(/^\.?\//, ''))) ng(`[配信許可] ${f}: ${ref} が functions/_middleware.js の FILES に無い（本番で404になる）`);
    }
  }
  for (const p of files) if (!exists(p.slice(1))) ng(`[配信許可] FILES の ${p} が存在しない`);
  for (const p of pages) if (!exists(`${p}.html`)) ng(`[配信許可] PAGES の ${p} に対応する ${p}.html が存在しない（削除したページなら PAGES からも外す）`);
}

if (problems.length) {
  console.log(`整合性チェック：${problems.length}件の問題\n` + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log('整合性チェック：OK');
