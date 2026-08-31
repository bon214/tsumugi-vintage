# TSUMUGI：GitHub Pages + Supabase 初回公開手順

この手順は、コードを書かずに「画面で設定する」「記載どおりのコマンドを貼り付ける」だけで進められるようにしています。作業対象は次のフォルダです。

```text
/Users/kubo_hayato/Documents/Codex/2026-08-30/claudedesign-lp-shop-github-pages-supabase
```

Downloads にある元データはバックアップとして残し、このフォルダを GitHub の原本にします。

## 最初に知っておくこと

- GitHub へ登録するのはプロジェクトのソースです。`dist/` を手動アップロードする必要はありません。GitHub Actions が安全な公開用 `dist/` を毎回作ります。
- ブラウザに置けるのは Supabase の **Publishable key** だけです。`Secret key` / `service_role` は GitHub のファイルや Actions に絶対に登録しません。
- 現在のローカル商品・記事はデモです。初回取込時に、商品・記事はすべて下書き、特集はすべて無効になります。確認してから1件ずつ公開できます。
- GitHub Pages はポートフォリオ／学習用デモとして使います。実決済、実注文、顧客の住所・電話番号・カード情報の受付には使いません。実店舗のECに切り替える段階ではフロントを商用利用可能なホスティングへ移します。

## 0. すでにローカル実装されているもの

- 商品、記事、トップ特集、ショップ特集を Supabase から読み書きするCMS接続層
- 公開行と下書きを分けるRLS権限、管理者ロール、画像Storageポリシー
- 管理画面の保存完了後に画面へ反映する非同期処理
- デモCMSデータの安全な初回取込（注文・顧客・認証データは対象外）
- 公開後の変更からGitHub Pages再ビルドを要求するEdge Function
- GitHub Actionsによるビルド、SEOページ生成、GitHub Pages公開
- 対話式ローカル設定、CMSバックアップ、接続済みビルド

まだ実行できていないのは、あなたのアカウントを必要とする「Supabaseプロジェクト作成」「GitHubリポジトリ作成」「秘密情報の登録」「リモートDBへの適用」です。

## 1. 先に控える5項目

メモアプリかパスワード管理アプリへ次を控えます。キーはこの文書へ書き込まないでください。

1. GitHubユーザー名：例 `kubo-hayato`
2. リポジトリ名：例 `tsumugi-portfolio`
3. 公開予定URL：例 `https://kubo-hayato.github.io/tsumugi-portfolio`
4. Supabase Project URL：例 `https://abcdefgh.supabase.co`
5. Supabaseの Publishable key と Secret key（または旧形式の `anon` と `service_role`）

## 2. GitHubリポジトリを作る（GitHub Desktop推奨）

この作業フォルダはローカルGitリポジトリとして初期化済みです。

1. GitHub Desktopを開き、`File` → `Add Local Repository`。
2. 本書冒頭の作業フォルダを選択。
3. Changes の Summary に `Initial TSUMUGI site` と入力し、`Commit to main`。
4. `Publish repository`。
5. Name を決めます。本書では `tsumugi-portfolio` とします。
6. GitHub FreeでPagesを使う場合は `Keep this code private` のチェックを外し、`Publish Repository`。
7. `.env.local`、`node_modules`、`dist` が変更一覧へ出ないことを確認します。出た場合はコミットせず中断してください。
8. 作成されたリポジトリURLを控えます。

ターミナルを使う場合は、GitHubでREADMEなしの空リポジトリを作り、画面に表示される `…or push an existing repository from the command line` の行をそのまま使用できます。

## 3. Supabaseプロジェクトを作る

1. Supabase Dashboardへログインし、`New project`。
2. Project name は `tsumugi-production` など判別できる名前。
3. Database Password は強い自動生成値にし、パスワード管理アプリへ保存。
4. Region は主な閲覧者に近いもの（日本向けなら Tokyo が候補）。
5. 作成完了後、`Project Settings` → `API Keys` で Project URL、Publishable key、Secret keyを控えます。

Secret keyはRLSを迂回できます。ローカル初回取込とバックアップにだけ使い、WebサイトやGitHubへ置きません。

## 4. ローカルとSupabaseを接続する

Macの「ターミナル」を開き、次を1ブロックずつ貼り付けます。

```bash
cd "/Users/kubo_hayato/Documents/Codex/2026-08-30/claudedesign-lp-shop-github-pages-supabase"
npm ci
npm run setup:local
```

最後のコマンドから4項目を質問されます。手順1と3で控えた公開URL、Project URL、Publishable key、Secret keyを貼り付けます。`.env.local` へ保存されますが、このファイルはGit除外済みです。

次にSupabaseへログインしてプロジェクトを紐づけます。

```bash
npx supabase login
npx supabase projects list
npx supabase link --project-ref YOUR_PROJECT_REF
```

`YOUR_PROJECT_REF` は Project URL の `https://` と `.supabase.co` の間です。例が `https://abcdefgh.supabase.co` なら `abcdefgh` です。

DB変更をいきなり適用せず、先に一覧だけ確認します。

```bash
npx supabase db push --dry-run
```

`0001` から `0011` までが表示されたら適用します。

```bash
npx supabase db push
```

成功するまでデモデータの取込や公開へ進みません。`db reset --linked` はリモートデータを消去するため、今後も実行しないでください。

## 5. デモ商品・記事を「すべて非公開」で取り込む

```bash
npm run cms:import-demo
```

成功時の目安：

```text
import complete: 30 products, 13 articles, 4 hero features, 3 special features — all draft/disabled
```

この取込には注文、顧客、パスワード、管理者アカウントは含まれません。何度実行してもSKU／slugで同じデモ行を更新する方式です。

## 6. 最初の管理者を作る

1. Supabase Dashboard → `Authentication` → `Users`。
2. `Add user` から自分のメールアドレスでユーザーを作るか、招待を送ります。
3. 招待の場合は届いたメールからパスワード設定を完了します。
4. Dashboard → `SQL Editor` → `New query`。
5. 次を貼り付け、メールアドレスだけ自分のものへ置き換えて `Run`。

```sql
insert into public.staff_roles (user_id, role, note)
select id, 'owner', 'initial site owner'
from auth.users
where email = 'YOUR_EMAIL@example.com'
on conflict (user_id) do update
set role = excluded.role,
    revoked_at = null,
    granted_at = now();
```

結果が `Success. No rows returned` なら正常です。すでにログインを試していた場合は、一度ログアウトして再ログインし、新しい権限をJWTへ反映します。

## 7. Supabase AuthのURLを設定する

Dashboard → `Authentication` → `URL Configuration`：

- Site URL：`https://GITHUB_NAME.github.io/REPOSITORY`
- Redirect URLs：`https://GITHUB_NAME.github.io/REPOSITORY/**`

Dashboard → `Authentication` → `Sign In / Providers`：

- Email：有効
- Confirm email：本番では有効
- Allow new users to sign up：管理者だけで運用するポートフォリオ段階では無効
- Anonymous sign-ins：読み取り専用のゲスト管理画面を見せる場合だけ有効。不要なら無効

## 8. GitHub Actionsの接続値を登録する

GitHubの対象リポジトリ → `Settings` → `Secrets and variables` → `Actions`。

`Variables` タブで2件：

| Name | Value |
|---|---|
| `SITE_URL` | `https://GITHUB_NAME.github.io/REPOSITORY` |
| `SUPABASE_URL` | `https://PROJECT_REF.supabase.co` |

`Secrets` タブで1件：

| Name | Value |
|---|---|
| `SUPABASE_PUBLISHABLE_KEY` | SupabaseのPublishable key |

Secret key / `service_role` は登録しません。

次に Repository → `Settings` → `Pages` → `Build and deployment` → `Source` を `GitHub Actions` にします。

## 9. 管理画面の公開操作から自動再ビルドさせる

GitHub右上プロフィール → `Settings` → `Developer settings` → `Personal access tokens` → `Fine-grained tokens` → `Generate new token`。

- Repository access：`Only select repositories` → このTSUMUGIリポジトリだけ
- Repository permissions：`Contents` を `Read and write`
- Expiration：必要最小限。期限切れ前に交換

生成されたトークンはこの画面を離れると再表示できないため、一時的にパスワード管理アプリへ保存します。

Supabase Dashboard → `Edge Functions` → `Secrets` へ次の4件を登録します。

| Name | Value |
|---|---|
| `SITE_ORIGIN` | `https://GITHUB_NAME.github.io`（リポジトリ名を付けない） |
| `GITHUB_REPOSITORY_OWNER` | GitHubユーザー名またはOrganization名 |
| `GITHUB_REPOSITORY_NAME` | リポジトリ名だけ |
| `GITHUB_PAGES_TOKEN` | 先ほどのFine-grained token |

Edge Functionをデプロイします。

```bash
npx supabase functions deploy request-site-build --use-api
```

`create-order` と `contact` は、実注文／実問い合わせを受け付ける別判断が必要なので、ポートフォリオ公開時にはデプロイしません。

## 10. 最初の公開

GitHub Desktopで未コミット変更を `Connect Supabase CMS` などの名前でコミットし、`Push origin`。

GitHub → `Actions` → `Build and deploy TSUMUGI` を開き、緑のチェックになるまで待ちます。失敗した場合は赤い工程名を開き、表示されたエラーをそのままサポートへ渡してください。

緑になったら次を確認します。

1. `https://GITHUB_NAME.github.io/REPOSITORY/` が開く。
2. `https://GITHUB_NAME.github.io/REPOSITORY/admin.html#/admin/login` が開く。
3. 手順6のメールとパスワードで管理者ログインできる。
4. 下書きの商品を1件編集して保存し、公開へ変更できる。
5. 商品画像（jpg/png/webp/avif、1点3MB以下）を追加できる。
6. 公開画面を再読込すると商品が見える。
7. GitHub Actionsに `repository_dispatch` 起点の新しい実行が生まれ、SEOページも更新される。

DBの公開データはサイト再読込時にすぐ反映されます。検索エンジン用の静的ページ、sitemap、JSON-LDはGitHub Actions完了後に反映されます。

## 11. 日常の運用

通常の更新：

1. `/admin.html#/admin/login` へログイン。
2. Products / News / Featured / Specials を編集。
3. 先に下書き保存、プレビュー確認、最後に公開。
4. GitHub Actionsが緑になったことを確認。

週1回、または大きな更新前にローカルでCMSバックアップ：

```bash
cd "/Users/kubo_hayato/Documents/Codex/2026-08-30/claudedesign-lp-shop-github-pages-supabase"
npm run cms:backup
```

`backups/` に商品・記事・特集だけがJSON保存されます。顧客・注文・認証情報は含まれず、GitHubにも登録されません。

ソース変更後のローカル確認：

```bash
npm test
npm run build:connected
```

最後に `verify: ... build accepted` と出れば公開用ファイルは合格です。

## 12. 無料枠と本番判断

小規模なポートフォリオCMSはSupabase Freeの範囲から始められます。ただし無料プロジェクトは一定期間アクセスがないと停止し、自動バックアップも含まれません。画像容量や転送量にも上限があります。定期的に `npm run cms:backup` を実行してください。

次は別リリースとして扱います。

- 実決済プロバイダ接続
- 実注文、住所、電話番号などの個人情報受付
- 特定商取引法表記、プライバシーポリシー、返品規約
- 商用利用可能ホスティングへの切替
- 本番メール（独自SMTP）、監視、復旧手順、有料バックアップ

上記がない状態で「実店舗ECとして注文受付可」とは判定しません。
