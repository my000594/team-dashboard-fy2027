# 認証（Cloudflare Access）・セキュリティ対応状況

> ルート`CLAUDE.md`から分離した開発メモ（2026-11-08）。該当ファイルを変更する前に読み、構造に関わる変更をしたらここを更新すること。
> 文中の「〇〇.htmlセクション」は`docs/dev/pages/〇〇.md`、「△△.js節」は`docs/dev/shared/`、「データフォーマット節」は`data/CLAUDE.md`、「組織設定」節・「技術スタック」節はルート`CLAUDE.md`を指す。


## 認証（Cloudflare Access）

サイト全体（`data/`配下のCSVも含む、`maintenance-app.html`も含む）に、Cloudflare Access（Zero Trust）で会社メールアドレス単位のOne-time PIN（OTP）認証をかけている。2026-08-08、共有ID・PASSのBasic認証から切替済み。

- Zero Trust → Access controls → Applications に、対象のPages公開ドメイン（Destinationsのパスは未指定＝サイト全体が対象）を対象としたApplication（`team-dashboard-fy2027.pages.dev`）を設定
- ポリシー：「Prod - Company domain OTP」（Allow、1ルール）。**Include = `Emails`＝対象メンバー分のメールアドレスを1件ずつ個別に列挙する方式**（ドメイン一致の`Emails ending in @〜`ワイルドカードではない。全員が同じ会社ドメインのアドレスを使っているためそう見えるだけ。2026-08-31にダッシュボードを実機確認し、以前の「ドメイン一致」という記載を訂正）／ログイン方式 = One-time PIN／Session Duration = 1ヶ月
- **ドメイン一致ではなく個別列挙のため、メンバーの異動・入れ替わりは自動反映されない**。新しくラインに加わった人はこのIncludeリストへの追加、異動・退職した人は削除を、Zero Trust側で都度手動対応する必要がある（member_master.csvのステータス更新とは別作業・別システムなので、どちらかを更新すればもう片方も自動で追随するわけではない点に注意）
- ログイン方式（Identity provider）：Zero Trust → Integrations → Identity providers に「One-time PIN」を明示的に登録している。**注意：** IdPを1件も登録しなければ自動的にOne-time PINがデフォルトになる仕様のはずだが、実際には登録なしの状態で「There are no login methods available for this account」エラーになったため、One-time PINは明示登録が必須（デフォルトIdPとして紛れ込んでいた「Cloudflare」（Cloudflareアカウントでのパスワードログイン）を削除した際に発覚）
- 旧Basic認証のフェイルクローズ処理だった`functions/_middleware.js`は2026-08-08に削除済み。認証はCloudflare Access側（エッジ）のみで行う。なお同じファイル名で2026-11-08に「配信許可リスト」を新設している（認証ではなく配信対象の絞り込み。下記節参照）
- AccessはCookie（`CF_Authorization`）ベースで同一オリジンの以降のリクエストにも適用されるため、クライアント側の`fetch()`は変更不要
- 個人単位のメールアドレス認証になったため、旧Basic認証の弱点だった「誰が・いつアクセスしたか」が区別できない問題は解消
- 不要になった`DASH_USER`／`DASH_PASS`のCloudflare Pages環境変数は削除して問題ない（未削除でも動作に影響はない）


## セキュリティ対応状況（2026-07-30時点）

部下への本格展開に向けて実施した対応と、対応していない既知の限界をまとめる。

**対応済み**
- サイト全体にCloudflare Access（会社メールアドレス単位のOTP認証）をかけ、URL単独では閲覧できないようにした（2026-08-08、共有Basic認証から切替済み。詳細は上記「認証」節）
- CSV・Notion由来の自由記述文字列（備考・氏名・顧客名・開催単位・達成状況等）をHTMLに埋め込む箇所は、各ページ内の`escHTML`（または`md.js`の`escapeHTML`/`esc`）を通すよう統一。以前は`meetings.html`と`reports.html`の一部列が無エスケープでinnerHTMLに入っており、Notion側の自由記述に`<`等が混ざると表示が壊れる／理論上コード注入の余地があった
- 全ページに`<meta name="robots" content="noindex, nofollow, noarchive">`を追加し、`robots.txt`で全体をDisallowにした（検索エンジンへの意図しないインデックス防止）
- 外部CDN（cdnjs経由のChart.js 4.4.1 / PapaParse 5.4.1）の`<script>`タグに`integrity`（SRI）・`crossorigin`・`referrerpolicy`を付与し、CDN側の改ざんを検知できるようにした。**ライブラリのバージョンを上げる場合は、新しいファイルのSHA-384ハッシュを取り直してintegrity属性も更新すること**（古いハッシュのまま新バージョンを指定すると、ブラウザがintegrity不一致でスクリプトをブロックしサイトが全面的に動かなくなる）
- `scripts/sync-notion.mjs`に`assertProperties()`を追加。各Notion DBの1件目のページに、期待するプロパティ名が存在するかを同期のたびにチェックする。Notion側でプロパティ名が変更・削除されると、これまでは該当項目が無言で空欄になり続けていた（実際に「組織構成図」見出し名変更で発生）。プロパティ名を追加・変更した場合はこのチェックリストも追随して更新すること

**既知の限界（未対応・運用でカバー）**
- Notionのプロパティ**名**の変更は`assertProperties()`で検知できるが、**型**の変更（例：テキスト→セレクト）や**値の中身が意図とズレる**ケース（誤入力等）までは検知できない
- Notion直アップロードファイル（`meeting_plan.csv`の資料リンク・`org_chart.csv`・`certifications.csv`のデジタルバッジ）は期限付きURLになり得るため、時間経過でリンク切れになることがある。エラー表示は出ないため、リンクを踏んだ人が気づく形になる。恒久リンクにしたい場合は外部ストレージ（Google Drive等）のリンクをNotionに貼る運用にすること
- Cloudflare Accessのメール許可リスト（前述「認証」節）はメンバーの異動・入れ替わりに自動追随しない。member_master.csvのステータスを「異動」「退職」に変えても、Zero Trust側のIncludeリストから明示的に削除しない限りアクセス権は残り続ける
- Zero Trust → Access controls → Policies に、旧Basic認証移行時に作った未使用のポリシー「Bypass - Basic auth still active」（Bypass、どのApplicationにも紐付いていない＝Used by applications: 0）が残っている。現状は何にも適用されていないため実害はないが、誤って新規Applicationに紐付けると認証を素通りさせてしまうため、使う予定がなければ削除しておくのが望ましい

## 配信許可リスト（functions/_middleware.js）

2026-11-08追加。Cloudflare Pagesはビルドコマンド・出力ディレクトリ未設定（リポジトリのルートをそのまま配信）のため、何もしないとダッシュボードからリンクしていない`docs/`（マニュアル・`skill_hearing_sheet.xlsx`）・`CLAUDE.md`・`data/CLAUDE.md`・`scripts/`・`.claude/`・`*.bat`等もURL直打ちで取得できていた（2026-11-08に本番で`/docs/skill_hearing_sheet.xlsx`が200で返ることを実機確認）。Access認証の内側ではあるが、「部下には表示に必要なもの以外は見せない」方針でルートにPages Functionsのミドルウェアを置き、**許可リスト方式**で絞り込んだ。

- 許可：`/`、`PAGES`に列挙したページ（`/xxx`と`/xxx.html`の両方）、`FILES`に列挙した共通ファイル（`style.css`・`nav.js`・`md.js`・`data.js`・`you-widget.js`・`robots.txt`・`config/org.json`）、`/data/`配下（`.md`を除く）、`/api/`配下
- それ以外はすべて`404 Not Found`（`cache-control: no-store`）。存在しないパスも同じ404になるため、ファイルの有無も分からない
- 判定は`new URL()`で`..`・`%2e%2e`を正規化した後のパスで行う（`/data/../docs/...`のような回り込みも404）
- 許可リスト方式にしたのは、拒否リスト方式だと今後リポジトリに増えたファイル（新しいメモ・スクリプト等）が自動で公開されてしまうため。引き換えに、**新しいページ・共通JS/CSS・ルート直下の配信ファイルを追加したら`PAGES`/`FILES`への追記が必須**。漏れは`node scripts/check-consistency.mjs`の「配信許可」チェックが検出する（全`*.html`がPAGESにあるか、各ページが`<script src>`/`<link href>`で読む同一オリジンのJS/CSSがFILESにあるか）。JSから動的に`fetch`する`data/`以外のファイルを追加した場合はチェックでは拾えないので手動で追記すること
- ルートにミドルウェアを置いたことで、静的ファイルへのリクエストもすべてPages Functionsの実行回数に数えられるようになった（無料枠は1日10万リクエスト。10名規模なら十分余裕がある）
- 実行順はルートの`functions/_middleware.js` → `functions/api/_middleware.js`（JWT検証）→ `functions/api/knowledge-votes.js`
