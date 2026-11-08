# CSV取得共通ヘルパー（data.js）

> ルート`CLAUDE.md`から分離した開発メモ（2026-11-08）。該当ファイルを変更する前に読み、構造に関わる変更をしたらここを更新すること。
> 文中の「〇〇.htmlセクション」は`docs/dev/pages/〇〇.md`、「△△.js節」は`docs/dev/shared/`、「データフォーマット節」は`data/CLAUDE.md`、「組織設定」節・「技術スタック」節はルート`CLAUDE.md`を指す。


`data/`配下のCSVをfetchする全ページ（index/info/member/reports/sales/meetings/chronicle/skill/knowledge/career）が共用する`fetchCSVText(path)`を提供する（2026-08-09追加）。ページ遷移の多いこのダッシュボードで、同じCSV（`member_master.csv`等）を毎回fetchし直すことによる体感速度の低下を避けるための共通化。

- `fetchCSVText(path)`は`{ ok, status, text }`を返す非同期関数。fetch＋BOM除去済みのテキストを取得し、成功時（`ok`）のみ`sessionStorage`に5分間（`CSV_CACHE_MS`）キャッシュする。キャッシュヒット時はfetchを行わずキャッシュしたエントリをそのまま返す
- Papa.parseは呼び出し側（各ページ）が担当する。`dynamicTyping`等のパースオプションはページごとに異なるため、data.js側では固定しない
- Notion同期は1日単位でしか更新されないため、5分程度のキャッシュによる鮮度への影響はほぼ無い
- `maintenance-app.html`が読む`data/maintenance.json`はこのヘルパーの対象外（即時反映が必要なため`cache:'no-store'`で都度fetchする方針を維持）。`nav.js`の`maintenance.json`fetchも同様に対象外
- career.htmlは自ページのデータはCSVではなくハードコーディングのため本来data.js不要だが、後述の`you-widget.js`が`fetchCSVText`に依存するため2026-08-11に読み込みを追加した
