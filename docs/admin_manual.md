# 管理マニュアル：社会情報インフラ部 第1ライン ダッシュボード

このダッシュボードを管理する人（現在は課長・米花）向けの運用手順書です。ここに書いてある通りに操作すれば、仕組みの詳細を覚えていなくても一通りの管理業務ができることを目指しています。

関連ドキュメント：[仕様書](./spec.md)｜[ユーザーマニュアル](./user_manual.md)

---

## 1. 管理者がやること一覧

| やること | 頻度 | 参照章 |
|----------|------|--------|
| Notionのデータ更新（→自動でサイトに反映） | 随時 | 2章 |
| メンバーの入退社・異動対応 | 発生都度 | 3章 |
| メンテナンスモードの切替 | データ更新・不具合対応時 | 4章 |
| Cloudflare Accessのアクセス許可管理 | メンバー変更時 | 5章 |
| 不具合・リンク切れ等のトラブル対応 | 発生都度 | 6章 |
| ナレッジ👍投票（誰が何に投票したか）の確認・DB再構築 | 必要になった時のみ | 7章 |

## 2. 日常運用：データを更新する

**このダッシュボードのデータはすべてNotionが元データです。** サイトのコードを直接編集する必要はありません。

1. Notion上の該当データベース（メンバー・売上・インフォメーション・ナレッジ・会議計画・スキル・保有資格・組織構成図など）を更新する
2. 何もしなくても**毎日6:00（日本時間）に自動同期**される
3. すぐに反映させたい場合は、GitHubリポジトリ（`my000594/team-dashboard-fy2027`）の **Actions タブ → 「Notionからデータ同期」→ Run workflow** を手動実行する
4. 数十秒〜数分でサイトに反映される（Cloudflare Pagesが自動デプロイ）

**うまく反映されない時の確認ポイント**
- Notion側のデータベース名やプロパティ（列）名を変更していないか（変更すると同期が壊れる。7章参照）
- GitHub Actionsの実行結果がエラーになっていないか（Actionsタブで確認できる。1つのデータベースでエラーが出ても他のデータベースの同期は止まらない設計）

## 3. メンバーの入退社・異動があったとき

1. Notionの「社会情報インフラ部_第1ライン」データベースで、対象者の「ステータス」を更新する（在籍→退職／異動など）
2. 新規メンバーの場合は行を追加し、必要な項目（氏名・役職・等級・所属ライン・入社年月日など）を入力する
3. 顔写真を使う場合は、リポジトリの`data/members/氏名.png`に画像を追加してGitHubにpush（Notion同期では自動更新されない、手動管理項目）
4. **新規メンバーがダッシュボードを閲覧できるように、Cloudflare Access側でもメールアドレスを許可リストに追加する**（5章参照。これを忘れるとNotionに登録してもログインできない）
5. 退職・異動でアクセスを止めたい場合は、Cloudflare Access側の許可リストからも該当メールアドレスを削除する

## 4. メンテナンスモードの切替

データ更新中や不具合対応中など、一時的にサイト全体を「メンテナンス中」表示に切り替えられます。

**方法A（推奨・最速）：メンテナンス切替アプリ**
1. `https://team-dashboard-fy2027.pages.dev/maintenance-app.html` をスマートフォンのホーム画面に追加しておく（アプリのように起動できる）
2. 初回のみGitHub PAT（後述7章）の入力が必要
3. 現在の状態に応じて「メンテナンスを開始」または「メンテナンスを解除」ボタンが表示されるのでタップ
4. 確認画面で実行すると、数秒〜数十秒で反映される（自動でポーリングして反映を確認してくれる）

**方法B：GitHub Actionsから手動実行**
1. GitHubリポジトリ → Actions タブ → 「メンテナンスモード切り替え」→ Run workflow
2. `mode` に `on`（開始）または `off`（解除）を選んで実行
3. メッセージ・復旧見込みは空欄でも可（前回の内容を維持する）

**方法C（フォールバック）：ファイルを直接編集**
`data/maintenance.json` の `active` を `true`/`false` に書き換えてGitHubにpushする。

## 5. Cloudflare Accessの管理（誰がログインできるか）

このダッシュボードはCloudflare Access（Zero Trust）で、許可された会社メールアドレスのみアクセスできるようにしています。

**設定場所**
Cloudflareダッシュボード（[dash.cloudflare.com](https://dash.cloudflare.com)）→ 該当アカウント → Zero Trust → **Access → Applications** → 対象アプリ（このダッシュボードの公開ドメインを指定したApplication）→ Policies

**基本の許可ルール**
- Include条件：`Emails ending in @会社ドメイン`（会社メールアドレスなら自動で許可）
- 会社ドメイン以外のメールアドレスを使う人（出向者・嘱託社員など）がいる場合は、同じポリシーにOR条件で個別メールアドレスを追加行として登録する

**新しいメンバーを追加する時**
- 会社ドメインのメールアドレスなら、通常は何もしなくても自動的にログインできる（ドメイン一括ルールに含まれるため）
- 会社ドメイン以外のメールアドレスの場合は、上記Policiesの画面で個別にメールアドレスを追加する

**メンバーのアクセスを止めたい時**
- 同じ画面で該当メールアドレスの行を削除する

**ログイン方式（Identity Provider）について**
- Zero Trust → **Integrations → Identity providers** に「One-time PIN」が登録されている。これが削除されると誰もログインできなくなるので、誤って削除しないよう注意
- セッション有効期間は1ヶ月に設定（Policy側の Session Duration）。期間を過ぎると再度メールでのワンタイムコード入力が必要になる

## 6. トラブルシューティング

| 症状 | 原因・対応 |
|------|-----------|
| データが更新されない | Notion側のプロパティ名変更、GitHub Actionsのエラーを確認（Actionsタブのログ）。`assertProperties()`がプロパティ名の変更を検知してエラーを出す仕組みがある |
| 資料・組織構成図・デジタルバッジのリンクが切れている | Notionに直接アップロードしたファイルは期限付きURLになるため、時間が経つとリンク切れになる。Google Drive等の外部ストレージにファイルを置き、Notion側にはそのリンクを貼る運用に切り替えると恒久リンクになる |
| 特定の人だけログインできない | Cloudflare Accessの許可リストにメールアドレスが登録されているか確認（5章） |
| 全員ログインできない・サインイン画面がおかしい | Zero Trust → Integrations → Identity providers に「One-time PIN」が存在するか確認。無い場合は「Add an identity provider」から追加し直す |
| サイトが真っ白・表示が崩れる | Cloudflare Pagesのデプロイが失敗している可能性。Cloudflareダッシュボード → Workers & Pages → team-dashboard-fy2027 → Deployments で直近のビルド状況を確認 |

## 7. ナレッジ👍投票データ（D1）の管理

`knowledge.html`の👍投票機能は、Notion同期とは無関係に**Cloudflare D1（`team-dashboard-fy2027-votes`）**というデータベースだけで完結している。ここでは①誰が何に投票したかを確認する方法、②万一DBが消えた・作り直しが必要になった場合の再構築手順、の2つをまとめる。

### 7-1. 「誰が何に投票したか」を確認する

1. [dash.cloudflare.com](https://dash.cloudflare.com) にログイン
2. 左サイドバー **Storage & databases → D1 SQLite Database**
3. 一覧から **`team-dashboard-fy2027-votes`** をクリック
4. 上部タブの **Console** をクリック
5. 下部の入力欄にSQLを打って **Execute**

よく使うクエリ例：

```sql
-- 全投票を新しい順に見る
SELECT * FROM votes ORDER BY created_at DESC LIMIT 20;

-- 特定の項目（ナレッジのタイトル文字列）に誰が押したか
SELECT voter_email, created_at FROM votes WHERE item_key = '項目のタイトル';

-- 特定の人が何に押したか
SELECT item_key, created_at FROM votes WHERE voter_email = 'xxx@会社ドメイン';

-- 項目ごとの合計だけ見たい（アプリのランキングと同じ集計）
SELECT item_key, COUNT(*) AS cnt FROM votes GROUP BY item_key ORDER BY cnt DESC;
```

- `item_key`はナレッジのタイトル文字列そのもの。`knowledge.html`に表示されているタイトルをそのままシングルクォートで囲んで貼ればよい
- ここでの操作は`SELECT`（読み取り）だけにとどめること。`DELETE`/`UPDATE`は投票データを直接壊せるため、誤って実行しないよう注意
- この画面にたどり着けるのはCloudflareアカウントにログインできる人のみ。部下側の画面・公開APIからは他人の投票内訳は一切見えない

### 7-2. DBを一から作り直す場合（初回構築・災害復旧時のみ）

通常運用では不要。DBを誤って削除した、新しい環境に作り直す、といった非常時のみ参照する。

1. **D1データベースを作成**
   Cloudflareダッシュボード → Storage & databases → D1 SQLite Database → 「Create Database」→ 名前を `team-dashboard-fy2027-votes` にして作成（**名前を変えるとPages側のバインディング設定と一致しなくなるので必ずこの名前にする**）
2. **テーブルを作成**
   作成したDBの Console タブを開き、`scripts/knowledge_votes_schema.sql`（リポジトリ内）の中身をそのまま貼り付けてExecute。以下の1テーブルが作られる。
   ```sql
   CREATE TABLE IF NOT EXISTS votes (
     item_key    TEXT NOT NULL,
     voter_email TEXT NOT NULL,
     created_at  TEXT NOT NULL,
     PRIMARY KEY (item_key, voter_email)
   );
   CREATE INDEX IF NOT EXISTS idx_votes_item_key ON votes(item_key);
   ```
3. **PagesプロジェクトにDBをバインド**
   Cloudflareダッシュボード → Workers & Pages → `team-dashboard-fy2027` → Settings → Bindings → 「+ Add」→ 「D1 database」を選び、変数名を **`DB`**（このスペルのまま。`functions/api/knowledge-votes.js`が`env.DB`という名前で参照している）、データベースは手順1で作った`team-dashboard-fy2027-votes`を選んで保存
   - **注意（ハマりどころ）：** D1データベースの選択欄は、実際には未選択でも候補が1件だけだと選択済みのように見えてしまうことがある。プルダウンを一度開いて候補をクリックし直してから保存し、保存後にBindings一覧を再読み込みして本当に追加されているか確認すること
4. **環境変数を設定**（JWT検証に必要。Production・Preview両方に設定）
   同じくSettings → Environment variables に以下を追加：
   - `TEAM_DOMAIN`：CloudflareのチームドメインURL（例：`https://xxxxx.cloudflareaccess.com`）。Zero Trust → Settings（サイドバー下部）→ Team name and domain で確認できる
   - `POLICY_AUD`：このダッシュボードのAccess ApplicationのAUDタグ。Zero Trust → Access controls → Applications → 対象アプリ → Additional settings タブ → AUD tag サブタブで確認できる
5. **再デプロイ**
   バインディング・環境変数はデプロイのたびに反映されるので、GitHubに何か1コミットpushするか、Pagesダッシュボードから直近のデプロイを「Retry deployment」して反映させる
6. 反映後、`knowledge.html`で適当な項目に👍を押してみて正常にカウントが増えること、7-1のSQLで該当行が入っていることを確認する

## 8. 秘密情報・アクセス権の管理場所一覧

| 情報 | 保管場所 | 備考 |
|------|---------|------|
| Notion Internal Integrationトークン | GitHub Secrets（`NOTION_TOKEN`） | リポジトリのコードには含まれない。Notion API同期に使用 |
| メンテナンス切替アプリ用のGitHub PAT | 各利用端末のブラウザlocalStorageのみ | リポジトリには含まれない。このリポジトリのActions実行権限のみに絞ったfine-grained PATを推奨。漏洩してもコードの読み書き・削除はできない設計 |
| ダッシュボードへのログイン許可 | Cloudflare Access（5章） | 個人のメールアドレス単位。共有パスワードは廃止済み |

**引き継ぐ場合に必要な権限**
- GitHubリポジトリ（`my000594/team-dashboard-fy2027`）へのアクセス権
- Cloudflareアカウントの管理権限（Pages・Zero Trust/Access両方）
- Notionワークスペースの該当ページ・データベースへのアクセス権

## 9. 緊急時対応

**サイトを今すぐ止めたい場合**
- 4章の方法Aまたは方法Bでメンテナンスモードをオンにする（数十秒で全ページがメンテナンス画面に切り替わる）

**特定の人のアクセスを緊急停止したい場合**
- 5章の手順でCloudflare Accessの許可リストから該当メールアドレスを削除する（次回アクセス時にブロックされる。すでにログイン中のセッションを即座に切りたい場合はCloudflareのサポートに確認が必要な場合がある）

**サイト自体を完全に停止したい場合**
- Cloudflareダッシュボード → Workers & Pages → team-dashboard-fy2027 の該当デプロイを削除、またはGitHub連携を解除する（通常運用では想定しない、最終手段）
