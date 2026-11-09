# CSV取得共通ヘルパー（data.js）

> ルート`CLAUDE.md`から分離した開発メモ（2026-11-08）。該当ファイルを変更する前に読み、構造に関わる変更をしたらここを更新すること。
> 文中の「〇〇.htmlセクション」は`docs/dev/pages/〇〇.md`、「△△.js節」は`docs/dev/shared/`、「データフォーマット節」は`data/CLAUDE.md`、「組織設定」節・「技術スタック」節はルート`CLAUDE.md`を指す。


`data/`配下のCSVをfetchする全ページ（index/info/member/reports/sales/meetings/chronicle/skill/knowledge/career）が共用する`fetchCSVText(path)`を提供する（2026-08-09追加）。ページ遷移の多いこのダッシュボードで、同じCSV（`member_master.csv`等）を毎回fetchし直すことによる体感速度の低下を避けるための共通化。

- `fetchCSVText(path)`は`{ ok, status, text }`を返す非同期関数。fetch＋BOM除去済みのテキストを取得し、成功時（`ok`）のみ`sessionStorage`に5分間（`CSV_CACHE_MS`）キャッシュする。キャッシュヒット時はfetchを行わずキャッシュしたエントリをそのまま返す
- **HTMLが返ってきた場合は失敗扱い**（2026-11-09）：本文が`<`で始まる場合は、HTTP 200でも`ok:false`（`status`は「HTMLが返されました」）にしてキャッシュもしない。以前は`404.html`が無かったためCloudflare Pagesが存在しないCSVのパスにも`index.html`を200で返しており、各ページがそれをCSVとしてパースして**エラーにならず「0件」と表示**していた（ルートに`404.html`を追加して根本対策済み。こちらはAccessのログイン画面等が返った場合も含めた二重の防御）
- **`requireCSVText(path)`**（2026-11-09追加）：表示に必須のCSV用。`fetchCSVText`を呼び、`ok`でなければ`「<path> が読み込めませんでした（<status>）」`の例外を投げ、テキストだけを返す。各ページの`init()`のcatchで「データの読み込みに失敗しました」を出させるため。使用箇所：index（`fetchCSV`内）・info・meetings・sales・member（member_master）・chronicle・reports（3se_report）・knowledge・portfolio（member_master）
- 補助的なCSV（取得できなくてもページ本体は表示したいもの）は従来どおり`fetchCSVText`で取得し、`ok`を見て空として扱う：member.htmlの`org_chart.csv`、portfolio.htmlのskill/certifications/3se_report_archive（`optText`）、reports.htmlの事例集・名簿、skill.htmlのcertifications、you-widget.jsの各CSV
- Papa.parseは呼び出し側（各ページ）が担当する。`dynamicTyping`等のパースオプションはページごとに異なるため、data.js側では固定しない
- Notion同期は1日単位でしか更新されないため、5分程度のキャッシュによる鮮度への影響はほぼ無い
- `maintenance-app.html`が読む`data/maintenance.json`はこのヘルパーの対象外（即時反映が必要なため`cache:'no-store'`で都度fetchする方針を維持）。`nav.js`の`maintenance.json`fetchも同様に対象外
- career.htmlは自ページのデータはCSVではなくハードコーディングのため本来data.js不要だが、後述の`you-widget.js`が`fetchCSVText`に依存するため2026-08-11に読み込みを追加した
