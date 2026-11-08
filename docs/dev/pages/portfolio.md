# portfolio.html（個人ポートフォリオ）

> ルート`CLAUDE.md`から分離した開発メモ（2026-11-08）。該当ファイルを変更する前に読み、構造に関わる変更をしたらここを更新すること。
> 文中の「〇〇.htmlセクション」は`docs/dev/pages/〇〇.md`、「△△.js節」は`docs/dev/shared/`、「データフォーマット節」は`data/CLAUDE.md`、「組織設定」節・「技術スタック」節はルート`CLAUDE.md`を指す。

- `?member=氏名`パラメータで表示するメンバーを指定。未指定の場合は`localStorage['you_widget_member']`（you-widget.jsと同じキー）にフォールバックし、それも無ければメンバーセレクター画面を表示する
- **nav.jsのNAV_ITEMSには載せない**。member.htmlのALLタブのTR行クリック・グループタブ（ライン別/役職別/等級別/委員会別）のchipクリックで`portfolio.html?member=氏名`へ遷移する設計（専用のメニュー項目を持たない）
- 取得するCSVは`member_master.csv` / `skill.csv` / `certifications.csv` / `3se_report_archive.csv`の4ファイルを並行fetch（`data.js`の`fetchCSVText`を使用）
- **評価時期の自動判定**（`detectLatestPeriod()`）：PERIODS配列（skill.htmlと同じ4時期）のうち、当該メンバーに1件でもレベル入力がある最新の時期を選ぶ。全時期未入力なら先頭時期
- **表示セクション**：
  - ヒーロー：顔写真（`data/members/氏名.png`）・氏名・役職・等級・所属ライン
  - メンバー切替チップ（在籍者一覧、クリックで同ページ内でメンバー切替）
  - レーダーチャート（サブカテゴリ平均。未評価レベル0も含む）＋得意分野テキスト
  - 分野別スキルバー（平均スコア順・降順）
  - 保有資格マトリクス（有効期限の色分けあり。資格分野に「研修」を含む行は除外）
  - 3SEレポート提出履歴（`3se_report_archive.csv`から氏名一致で抽出・新しい順）
- you-widget.jsは読み込まない（ウィジェット不要）。nav.jsは読み込む（ナビバーのみ利用）
