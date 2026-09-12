# TSUMUGI — Google Analytics 4 設定・運用手順

この文書は、TSUMUGIの公開サイト
`https://bon214.github.io/tsumugi-vintage/` に組み込まれたGA4計測の設定と、
制作者・検証アクセスを除外する方法を記録します。GA4無料版だけを使用し、
Analytics 360、BigQuery、有料の外部解析サービスは使用しません。

## 現在の状態

サイト側の実装、テスト、GitHub Pagesのビルド設定は完了しています。ただし、
ソースコードには測定IDを保存しません。TSUMUGI専用の `G-XXXXXXXXXX` を
GitHubのRepository variableへ登録するまで、本番サイトからGoogleへ計測通信は
送られません。LUMIE SKINの測定IDは流用せず、作品ごとにプロパティを分けます。

## 1. Google Analytics側の準備

1. 自主制作サイト用のAnalyticsアカウントを開きます。
2. `TSUMUGI Portfolio` というGA4プロパティを作成します。
3. レポートのタイムゾーンを日本、通貨を日本円にします。
4. ウェブデータストリームを作成します。
   - ウェブサイトURL: `https://bon214.github.io/tsumugi-vintage/`
   - ストリーム名: `TSUMUGI Portfolio — GitHub Pages`
5. 表示された `G-` で始まる測定IDを控えます。
6. 管理 > データの収集と修正 > データの保持で、イベントデータの保持を14か月にします。

### 拡張計測の設定

TSUMUGIはハッシュルーティングを使うSPAです。サイト側がルート確定後に
`page_view` を1回だけ送り、ページごとに90%到達を `scroll` として送ります。
二重送信を避けるため、ウェブストリームの拡張計測では次を無効にします。

- 「ページビュー」の詳細設定にある、ブラウザ履歴イベントに基づくページ変更
- 「スクロール数」

その他の拡張計測は、必要なものだけ有効にできます。自動リロード用の
`__tsumugi_update`（および旧互換の更新マーカー）は計測URLから除外され、30秒以内の
同一URLリロードは通常の追加ページビューにしません。

## 2. GitHub Pagesへ測定IDを接続

GitHubで `bon214/tsumugi-vintage` を開き、次の順に操作します。

1. **Settings**
2. **Secrets and variables** > **Actions**
3. **Variables** タブ > **New repository variable**
4. Name: `GA4_MEASUREMENT_ID`
5. Value: Google Analyticsで控えた `G-XXXXXXXXXX`
6. **Add variable**
7. **Actions** > **Build and deploy TSUMUGI** > **Run workflow**

測定IDは公開サイトへ配布される識別子で、パスワードや秘密鍵ではありません。
ただし変更箇所を一つに保つため、ソースへ直書きせずRepository variableで管理します。

## 3. 制作者・確認ブラウザを除外

測定IDを接続した後、普段TSUMUGIを確認する各ブラウザで、最初に次のURLを
一度だけ開きます。

`https://bon214.github.io/tsumugi-vintage/?analytics=off#/analytics`

この指定はGoogleタグを読み込む前に処理され、除外状態をブラウザの
`localStorage` に保存します。設定後はURLの `?analytics=off` が自動的に消え、
「アクセス解析設定」画面に「計測対象外」と表示されます。

- 別端末、別ブラウザ、別ブラウザプロファイルでは個別に設定します。
- シークレットモードやサイトデータ削除後は再設定します。
- フッターの「アクセス解析設定」から状態確認・解除ができます。
- ローカルHTTP、異なるホスト、管理画面、WebDriverによる自動テストは自動的に無効です。
- アシスタントが公開表示を確認するときも、必ず上記の除外URLから開始します。

## 4. 計測イベント一覧

| イベント | 対象 |
|---|---|
| `page_view` | ホーム、ショップ、商品、記事、特集、About、Contact、Account等の仮想ページと制作解説 |
| `scroll` | 各仮想ページの約90%地点への初回到達 |
| `menu_open` | メニューを開く |
| `search_open` / `search_result_select` | 検索を開く / 検索結果を選ぶ |
| `hero_select` | Heroの主要導線を選ぶ |
| `account_open` | Account導線を開く |
| `wishlist_toggle` | お気に入りを追加・解除する |
| `demo_cart_open` / `demo_cart_add` / `demo_cart_remove` / `demo_cart_review` | デモカート操作 |
| `demo_checkout_step` | デモ購入画面の段階移動 |
| `demo_order_submit` / `demo_order_error` / `demo_order_complete` | デモ注文操作 |
| `demo_contact_submit` | お問い合わせデモの送信完了 |
| `demo_newsletter_submit` | ニュースレターデモの送信完了 |
| `case_study_site_select` | 制作解説からTSUMUGI本体または解析設定へ移動 |

デモ注文は `purchase`、`refund`、売上、価格、注文番号として送信しません。
氏名、メールアドレス、住所、電話番号、郵便番号、問い合わせ本文、検索語、
認証トークン、顧客IDもイベントへ送りません。管理画面はGAスクリプト自体を
読み込みません。

## 5. UTM付き掲載リンク

クラウドワークスへ掲載するTSUMUGIのリンク例です。

`https://bon214.github.io/tsumugi-vintage/?utm_source=crowdworks&utm_medium=referral&utm_campaign=portfolio#/home`

作品外からの掲載リンクだけにUTMを付け、サイト内リンクには付けません。
個人名、メールアドレス、案件名など個人や顧客を識別できる値は使いません。
サイトは `utm_source`、`utm_medium`、`utm_campaign` だけを計測URLに残し、
それ以外のクエリ値はGA4へ送りません。

## 6. 導入後の確認

1. 制作者用とは別のブラウザで通常URLを開きます。
2. GA4のDebugViewまたはリアルタイムで `page_view` を確認します。
3. ホームからショップ、商品詳細へ移動し、各画面につき1件だけ届くことを確認します。
4. ページ下部までスクロールし、`scroll` が1件だけ届くことを確認します。
5. デモボタンを1回操作し、対応イベントが1件だけ届くことを確認します。
6. 制作者用ブラウザではGoogleへの計測通信がないことを確認します。
7. UTM付きURLを別ブラウザで開き、流入元を確認します。

DebugViewで使った開発者トラフィックをGA4側で除外する場合、データフィルタは
最初に「テスト」状態で確認してから有効にします。有効な除外フィルタで除外された
データは復元できません。

## 7. プライバシー上の運用

公開サイトの「アクセス解析設定」画面に、利用目的、計測内容、非送信情報、
このブラウザの除外操作を表示しています。広告シグナル、広告ユーザーデータ、
広告パーソナライズは無効です。

現在の方式は日本を主対象にした、広告を伴わないポートフォリオ計測です。
EEA・英国・スイス等を積極的に対象化する、広告機能を追加する、または利用地域・
法的要件が変わる場合は、タグ送信前の同意管理を別途導入してから公開します。

## 公式資料

- [Googleタグのデータ収集を無効にする](https://developers.google.com/tag-platform/security/guides/privacy)
- [GA4でページビューを測定する](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [シングルページアプリケーションの測定](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications)
- [拡張計測機能](https://support.google.com/analytics/answer/9216061?hl=ja)
- [データの保持](https://support.google.com/analytics/answer/7667196?hl=ja)
- [データフィルタ](https://support.google.com/analytics/answer/13296761?hl=ja)
- [GA4をContent Security Policyと併用する](https://developers.google.com/tag-platform/security/guides/csp?hl=ja)
