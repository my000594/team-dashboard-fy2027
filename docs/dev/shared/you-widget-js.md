# 「あなたの状況」ウィジェット（you-widget.js）

> ルート`CLAUDE.md`から分離した開発メモ（2026-11-08）。該当ファイルを変更する前に読み、構造に関わる変更をしたらここを更新すること。
> 文中の「〇〇.htmlセクション」は`docs/dev/pages/〇〇.md`、「△△.js節」は`docs/dev/shared/`、「データフォーマット節」は`data/CLAUDE.md`、「組織設定」節・「技術スタック」節はルート`CLAUDE.md`を指す。


ページ見出しと同じ行の右側（`.page-header.with-you`）に配置する自分専用ミニダッシュボード。**maintenance-app.htmlを除く全ページ**（トップ含む）で同じ見た目・同じ挙動になるよう、2026-08-11にindex.html専用の実装からyou-widget.js（`data.js`と同様、nav.jsの直後で読み込む共通スクリプト）に切り出した。誰が見ているか分からない（ログイン機構がない）ため、初回だけ手動で名前を選ばせ、以降は`localStorage`（キー`you_widget_member`。全ページ共通のキーのため、どのページで選んでも他ページに引き継がれる）に記憶して自動表示する方式。

- 各ページのHTML側は`id="youMini"`以下の同一マークアップ（`.page-header`直下）を置くだけでよい。ページ本体のスクリプトからの呼び出しは不要で、you-widget.js自身が`#youMini`の有無を見て自動初期化する（無ければ何もしない）
- `member_master.csv`・`3se_report.csv`・`skill.csv`・`certifications.csv`をyou-widget.js自身がfetchする（各ページ本体が読むデータとは独立）。`fetchCSVText`の5分キャッシュにより、ページ本体側で同じCSVを既に読んでいても実質の二重fetchにはならない
- 表示する3指標：
  - **3SEレポート提出件数**：`3se_report.csv`から`社員番号`列（実体は氏名）で本人の行を検索し、月別列直接合算の件数と`達成状況`列をバッジ表示。クリックで`reports.html`へ
  - **得意なスキル分野**：`skill.csv`の分野（サブカテゴリ。無ければカテゴリ）ごとに、評価時期が「データが1件以上入っている時期のうち最新のもの」（skill.htmlの既定期間ロジックと同じ）における平均レベルを算出し、最も高い分野を表示（未評価スキル＝レベル0も含めて平均する。skill.htmlのレーダーチャート「総合」タブと同じ計算方法）。クリックで`skill.html?member=氏名&tab=radar&group=分野名`へ（本人選択＋レーダーチャートタブ＋該当分野タブが自動で開く）。全分野で平均0（未評価）の場合は「評価データなし」と表示
  - **保有資格**：`certifications.csv`から本人の行数をカウント。**資格分野に「研修」という文字列を含む行は資格そのものではなく研修受講の記録のためカウントに含めない**（一覧側＝skill.htmlの💯保有資格カードには残す。2026-08-11変更）。クリックで`skill.html?member=氏名#certifications`へ（本人選択＋💯保有資格カードまで自動スクロール）
  - 名前ブロック・各指標はそれぞれ幅を固定（CSSの`flex-basis`）しており、選ぶ人によって値の長さが変わってもウィジェット全体の横幅は変動しない（値がその幅に収まらない場合は折り返す。省略記号は使わない）。ラベルを上段・値＋補足を下段に分けているのは、1行にまとめると値がラベルの続きとして詰め込まれて変な位置で折り返っていたため
  - メンバー切替の候補一覧（ドロップダウン）は`position:absolute`のオーバーレイ表示にしており、開いてもウィジェット自体の高さ・下のカードの位置は動かない。名前を選ぶとこの切替パネルだけが閉じ、指標の表示状態（モバイルの展開有無）はさわらない
  - モバイル（〜560px）は名前部分だけの1行に折りたたみ、タップすると指標＋切替リストがまとめて下に展開する（`page-header`がflex-wrapで折り返すため、タイトル下に自然に回り込む）
  - `skill.csv`・`certifications.csv`が取得できなくてもページ本体の表示は継続する（該当の指標は「評価データなし」等のフォールバック表示になる）。`member_master.csv`・`3se_report.csv`が取得できない場合はウィジェット自体を表示しない
- CSS（`.you-mini*`）はstyle.cssに集約。ページ見出し行を横並びにする`.page-header.with-you`もstyle.cssで定義しているため、ウィジェットを置くページの`.page-header`には`with-you`クラスを付けるだけでよい
- 選択メンバーが変わるたびに（初回表示・チップ切替のどちらでも）`window.dispatchEvent(new CustomEvent('you-widget-changed', {detail:{name}}))`を発火する（2026-08-18追加）。他ページのスクリプトがこのウィジェットの選択に追従したい場合に購読する想定で、現状はskill.htmlの「チーム全体」レーダーの自動比較線がこれを使っている（詳細はskill.htmlセクション参照）。`localStorage.setItem`の**後**に発火させている点に注意（先に発火させると、購読側がその場で`localStorage`を読み直しても書き込み前の古い値を拾ってしまう）
- 新しいページを追加してウィジェットも置く場合は、他ページの`.page-header.with-you`ブロックと同じマークアップをコピーし、`<script src="data.js">`の直後に`<script src="you-widget.js">`を追加すればよい（Papaparse本体のCDN読み込みも必要）
- スキルマップの評価時期（`YOU_SKILL_PERIODS`）はyou-widget.js内にも定義がある。新しい時期を追加する際は、一次情報源の`config/org.json`（`skillPeriods`）に加え、ハードコードしている`scripts/sync-notion.mjs`の`SKILL_PERIODS`・`portfolio.html`の`PERIODS`・`skill.html`のフォールバック値も揃えること（`node scripts/check-consistency.mjs`で一致を確認できる）
