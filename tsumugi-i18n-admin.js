/* TSUMUGI bilingual copy — admin console
   Named admin keys plus the English/Japanese pair table whose derived keys
   (kXxx) the console templates reference.
   Load order: this file must run BEFORE tsumugi-i18n.js, which reads
   window.TSUMUGI_I18N_PARTS and exposes the public window.TSUMUGI_I18N API. */
(function () {
  "use strict";
  var P = (window.TSUMUGI_I18N_PARTS = window.TSUMUGI_I18N_PARTS || {});
  /* ---- admin console ---- */
  var ADM = {
    adminConsole:    ["ADMIN CONSOLE", "管理コンソール"],
    signIn:          ["Sign in", "サインイン"],
    signOut:         ["Sign out", "サインアウト"],
    emailAddress:    ["Email address", "メールアドレス"],
    password:        ["Password", "パスワード"],
    rememberMe:      ["Keep me signed in", "サインインを保持する"],
    demoCreds:       ["Demo credentials", "デモ用アカウント"],
    dashboard:       ["Dashboard", "ダッシュボード"],
    products:        ["Products", "商品"],
    customers:       ["Customers", "顧客"],
    news:            ["News & Journal", "お知らせ・ジャーナル"],
    settings:        ["Settings", "設定"],
    viewStore:       ["View store", "ストアを見る"],
    search:          ["Search", "検索"],
    save:            ["Save", "保存"],
    saveChanges:     ["Save changes", "変更を保存"],
    cancel:          ["Cancel", "キャンセル"],
    delete:          ["Delete", "削除"],
    edit:            ["Edit", "編集"],
    status:          ["Status", "ステータス"],
    // product form validation
    productNameRequired: ["A product name is required.", "商品名を入力してください。"],
    skuRequired:     ["A SKU is required so the piece can be traced.", "SKUを入力してください。一点ごとの追跡に必要です。"],
    skuInUsePre:     ["That SKU is already used by ", "このSKUは「"],
    skuInUsePost:    [".", "」ですでに使用されています。"],
    brandRequired:   ["A brand or maker is required.", "ブランドまたはメーカーを入力してください。"],
    // news scheduling button
    schedulePre:     ["Schedule for ", ""],
    schedulePost:    ["", " に公開予約"],
    scheduleNoDate:  ["Schedule publication", "公開予約"],
    published:       ["Published", "公開中"],
    draft:           ["Draft", "下書き"],
    soldOut:         ["Sold out", "売り切れ"],
    scheduled:       ["Scheduled", "公開予約"],
    notFound:        ["Not found", "見つかりません"],
    backToList:      ["Back to list", "一覧に戻る"],
    loading:         ["Loading…", "読み込み中…"],
    noResults:       ["No results", "該当なし"],
    resetDemo:       ["Reset demo data", "デモデータをリセット"],
    language:        ["Language", "言語"],
    langHint:        ["Applies to both the admin console and the public store.", "管理コンソールと公開ストアの両方に適用されます。"],
    japanese:        ["Japanese", "日本語"],
    english:         ["English", "English"],

    /* ---- authentication ---- */
    authAdministration: ["ADMINISTRATION", "管理画面"],
    authSignInIntro: ["Sign in with a staff account to manage the store.", "管理者アカウントでサインインして、ストアを管理します。"],
    authFailed:      ["We couldn't sign you in. Check your email address and password.", "ログインできませんでした。メールアドレスとパスワードをご確認ください。"],
    authEmailNeeded: ["Enter your email address.", "メールアドレスを入力してください。"],
    authPassNeeded:  ["Enter your password.", "パスワードを入力してください。"],
    authForgot:      ["Forgot your password?", "パスワードをお忘れですか？"],
    authRecoverHead: ["Set a new admin password", "管理者用の新しいパスワードを設定"],
    authRecoverIntro: ["This recovery link was verified for a staff account. Set a new password below.", "管理者アカウント用の回復リンクを確認しました。新しいパスワードを設定してください。"],
    authRecoverExpired: ["This admin recovery link has expired or has already been used. Return to sign in and request a new one.", "この管理者用リンクは期限切れか、すでに使用されています。サインイン画面に戻り、再度お手続きください。"],
    authRecoverUnsupported: ["Password recovery is unavailable until Supabase Auth is connected.", "Supabase Auth が接続されるまで、パスワードの再設定は利用できません。"],
    authEmailInvalid: ["Enter a valid email address.", "有効なメールアドレスを入力してください。"],
    authResetRateLimited: ["Too many recovery emails were requested. Wait a few minutes, then try again.", "再設定メールの送信回数が上限に達しました。数分待ってから再度お試しください。"],
    authResetFailed: ["We couldn't send the recovery email. Wait a moment and try again.", "再設定メールを送信できませんでした。しばらく待ってから再度お試しください。"],
    authResetSent: ["If this address belongs to a staff account, an admin recovery email has been sent.", "このメールアドレスが管理者アカウントに登録されている場合、管理者用の再設定メールを送信しました。"],
    authNewPassword: ["New admin password", "管理者用の新しいパスワード"],
    authConfirmPassword: ["Confirm new password", "新しいパスワード（確認）"],
    authPasswordHint: ["Use at least 8 characters.", "8文字以上で設定してください。"],
    authPasswordMismatch: ["The passwords do not match.", "確認用パスワードが一致しません。"],
    authSavePassword: ["Save new password", "新しいパスワードを保存"],
    authSavingPassword: ["Saving…", "保存中…"],
    authRecoverFailed: ["We couldn't update the password. Request a new admin recovery email and try again.", "パスワードを更新できませんでした。管理画面から再設定メールを再度送信してください。"],
    authRecoverDone: ["Your admin password was updated. Sign in again with the new password.", "管理者用パスワードを更新しました。新しいパスワードで再度サインインしてください。"],
    authBackToSignIn: ["Back to admin sign in", "管理者サインインに戻る"],
    authOr:          ["or", "または"],
    authGuestEnter:  ["VIEW AS GUEST", "ゲストとして見る"],
    authGuestWait:   ["OPENING…", "準備中…"],
    authGuestFailed: ["Guest access is unavailable. Anonymous sign-in may be disabled for this project.", "ゲスト閲覧を利用できません。匿名サインインが無効な可能性があります。"],
    authLocalMode:   ["Demo mode — credentials are checked in the browser. Supabase Auth is not connected yet.", "デモモード — 認証はブラウザ内で処理しています。Supabase Auth は未接続です。"],
    guestBadge:      ["GUEST", "ゲスト"],
    guestReadOnly:   ["READ ONLY", "閲覧のみ"],
    guestNoticeHead: ["Read only", "閲覧モード"],
    guestNoticeBody: ["Guest access lets you explore the administration interface. Changes cannot be saved.", "ゲストでは管理画面を閲覧できますが、内容の変更・保存はできません。"],
    guestBlocked:    ["Guest access is read only — that change was not saved.", "ゲストは閲覧のみです — 変更は保存されません。"],
    guestSignedIn:   ["Signed in as a guest", "ゲストとして閲覧中"],
    roleGuest:       ["Guest", "ゲスト"],

    /* ---- featured content (top-page hero) ---- */
    fcTitle:         ["Featured Content", "注目コンテンツ"],
    fcSubtitle:      ["What the top page hero shows, and in what order", "トップページのHeroに表示する内容と、その順番"],
    fcHeroHead:      ["TOP PAGE HERO", "トップページ HERO"],
    fcHeroNote:      ["The hero shows these in order. Anything disabled, unpublished or missing is skipped.", "Heroはこの順に表示します。無効・未公開・参照切れのものはスキップされます。"],
    fcAdd:           ["Add feature", "Featureを追加"],
    fcPosition:      ["Position", "表示順"],
    fcSourceType:    ["Source type", "ソース種別"],
    fcSource:        ["Source", "ソース"],
    fcDestination:   ["Destination", "リンク先"],
    fcSourceStatus:  ["Source status", "ソースの状態"],
    fcJournalType:   ["Journal", "ジャーナル"],
    fcPageType:      ["Page", "ページ"],
    fcPickArticle:   ["Select an article…", "記事を選択…"],
    fcPickPage:      ["Select a page…", "ページを選択…"],
    fcEnabledState:  ["Enabled", "有効"],
    fcDisabledState: ["Disabled", "無効"],
    fcEnable:        ["Enable", "有効にする"],
    fcDisable:       ["Disable", "無効にする"],
    fcMoveUp:        ["Move up", "上へ移動"],
    fcMoveDown:      ["Move down", "下へ移動"],
    fcRemove:        ["Remove", "削除"],
    fcLive:          ["In the hero", "Heroに表示中"],
    fcNotLive:       ["Not in the hero", "Heroには非表示"],
    fcUnset:         ["No source set", "ソース未設定"],
    fcUnsetNote:     ["Choose a source before enabling this feature.", "有効にする前にソースを設定してください。"],
    fcMissing:       ["Source missing", "ソースが見つかりません"],
    fcMissingNote:   ["The article this feature pointed to no longer exists. The hero skips it; nothing was substituted.", "このFeatureが参照していた記事は存在しません。Heroではスキップされ、別の記事に差し替えられることはありません。"],
    fcUnpublished:   ["Not public", "非公開"],
    fcUnpubNote:     ["This article is not published, so it will not appear in the hero.", "この記事は現在公開されていないため、Heroには表示されません。"],
    fcNoLive:        ["No feature can appear in the hero right now. The storefront falls back to Online Shop and About.", "現在Heroに表示できるFeatureがありません。公開側はオンラインショップとAboutで代替表示されます。"],
    fcManyNotice:    ["Five or more features make the hero longer to get through.", "Featureが5件以上になると、Heroの情報量が増えます。"],
    fcAtMax:         ["The hero holds at most {n} features.", "Heroは最大{n}件までです。"],
    fcRemoveQ:       ["Remove this feature from the hero?", "このFeatureをHeroから外しますか？"],
    fcRemoveBody:    ["The hero stops showing it. The article or page itself is not deleted.", "Heroから外れます。記事やページ自体は削除されません。"],
    fcSavedToast:    ["Hero updated", "Heroを更新しました"],
    fcRemovedToast:  ["Feature removed from the hero", "FeatureをHeroから外しました"],
    fcMovedToast:    ["Hero order updated", "Heroの順番を変更しました"],
    fcReadOnly:      ["Your role can view featured content but not change it.", "現在の権限では、注目コンテンツの閲覧のみ可能です。"],
    fcPageShop:      ["Online Shop", "オンラインショップ"],
    fcPageAbout:     ["About TSUMUGI", "TSUMUGIについて"],
    fcPageJournal:   ["Journal index", "ジャーナル一覧"],
    fcPageContact:   ["Contact", "お問い合わせ"],
    fcEmpty:         ["The hero has no features yet.", "Heroに登録されたFeatureがありません。"],
    fcEmptyBody:     ["Add a feature to choose what the top page shows.", "Featureを追加して、トップページに表示する内容を選んでください。"],

    /* ---- special features (curated product stories shown in Shop) ----
       A different thing from Featured Content above: that controls the home
       hero, this curates products for the Shop page. */
    sfTitle:         ["Special Features", "特集"],
    sfSubtitle:      ["Curated product stories shown in Shop", "ショップに掲載する商品特集"],
    sfIntroHead:     ["SHOP FEATURE", "ショップ 特集"],
    sfIntroNote:     ["Choose the theme and the pieces; the shop handles the rest — publication dates, sold-out pieces and layout. Featured Content, in the section above, controls the home hero instead.",
                      "テーマと商品はこちらで編集します。掲載期間・売り切れ商品の除外・レイアウトはシステム側で処理します。上の「注目コンテンツ」はトップページのHeroを管理する別機能です。"],
    sfNew:           ["New feature", "特集を追加"],
    sfReadOnly:      ["Your role can view special features but not change them.", "現在の権限では、特集の閲覧のみ可能です。"],
    sfEmpty:         ["No special features yet.", "特集がまだありません。"],
    sfEmptyBody:     ["Create one to curate a group of pieces for the shop page.", "特集を作成して、ショップに掲載する商品を編集してください。"],
    sfShownNow:      ["Shown in Shop now", "ショップに表示中"],
    sfNotShown:      ["Not shown publicly", "公開されていません"],
    sfStateActive:   ["Active", "公開中"],
    sfStateScheduled:["Scheduled", "公開予約"],
    sfStateArchived: ["Archived", "アーカイブ"],
    sfStateDraft:    ["Draft", "下書き"],
    sfNoLiveFeature: ["No feature is on show in the shop right now.", "現在ショップに表示されている特集はありません。"],
    sfNoEligible:    ["No candidate piece is publicly available, so this feature stays hidden.", "公開可能な候補商品がないため、この特集はショップに表示されません。"],
    sfEnable:        ["Enable", "有効にする"],
    sfDisable:       ["Disable", "無効にする"],
    sfDuplicate:     ["Duplicate", "複製"],
    sfDelete:        ["Delete", "削除"],
    sfDeleteQ:       ["Delete this feature?", "この特集を削除しますか？"],
    sfDeleteBody:    ["The feature and its curation are removed. The products themselves are not deleted.", "特集と編集内容が削除されます。商品自体は削除されません。"],
    sfEdit:          ["Edit", "編集"],
    sfMoveUp:        ["Move up", "上へ移動"],
    sfMoveDown:      ["Move down", "下へ移動"],
    sfBack:          ["All features", "特集一覧"],
    sfTitleJa:       ["Title (JA)", "タイトル（日本語）"],
    sfTitleEn:       ["Title (EN)", "タイトル（英語）"],
    sfDescJa:        ["Description (JA)", "説明（日本語）"],
    sfDescEn:        ["Description (EN)", "説明（英語）"],
    sfCategory:      ["Category label", "カテゴリ表記"],
    sfEra:           ["Era label", "年代表記"],
    sfPublishAt:     ["Publish date", "掲載開始"],
    sfUnpublishAt:   ["End date", "掲載終了"],
    sfScheduleNote:  ["A feature goes on show from its publish date until its end date. Leave the end date empty to keep it on show. The shop holds one feature at a time, so keep the dates of enabled features apart.",
                      "掲載開始から掲載終了までショップに表示されます。終了を空欄にすると掲載を続けます。ショップに表示できる特集は1件なので、有効な特集の掲載期間は重ならないように設定してください。"],
    sfNeedsDate:     ["No publish date — this feature cannot go on show yet.", "掲載開始が未設定のため、まだ公開されません。"],
    sfOverlap:       ["Dates overlap: {names}", "掲載期間が重なっています：{names}"],
    sfOverlapNote:   ["The shop shows one feature at a time — the one published most recently.", "ショップに表示されるのは1件だけで、掲載開始が最も新しい特集になります。"],
    sfCandidates:    ["Candidate products", "候補商品"],
    sfCandidateNote: ["Pick five to eight pieces. The shop uses the first ones that are publicly available and skips the rest, in this order.",
                      "5〜8点を選んでください。ショップではこの順に、公開可能な商品から使用されます。"],
    sfCandidateCount:["{n} selected", "{n}点選択中"],
    sfCandidateFull: ["A feature holds at most {n} candidate products.", "候補商品は最大{n}点までです。"],
    sfSearchProducts:["Search products", "商品を検索"],
    sfAdd:           ["Add", "追加"],
    sfRemove:        ["Remove", "外す"],
    sfSoldWarn:      ["Sold out — skipped on public site", "売り切れ — 公開側では表示されません"],
    sfDraftWarn:     ["Draft — not eligible for public display", "非公開 — 公開側では表示されません"],
    sfMissingWarn:   ["Product missing — skipped on public site", "商品が見つかりません — 公開側では表示されません"],
    sfEligible:      ["Shown publicly", "公開対象"],
    sfMedia:         ["Feature visuals", "特集ビジュアル"],
    sfMediaNote:     ["Each frame shows a photograph you choose from the candidate products. Left automatic, it follows the candidate order and moves on when a piece sells.",
                      "各枠には候補商品の写真を指定できます。自動のままにすると候補順に従い、売り切れた商品は次の候補に切り替わります。"],
    sfVisualManual:  ["Chosen", "指定"],
    sfVisualAuto:    ["Automatic", "自動"],
    sfVisualAutoBody:["Chosen from the candidate products", "候補商品から自動で選択"],
    sfVisualChoose:  ["Choose image", "画像を指定"],
    sfVisualChange:  ["Change image", "画像を変更"],
    sfVisualReset:   ["Return to automatic", "自動選択に戻す"],
    sfVisualClose:   ["Done", "閉じる"],
    sfVisualProduct: ["Product", "商品"],
    sfVisualImages:  ["Product images", "商品画像"],
    sfVisualPicked:  ["Image {n} of {total}", "画像 {n} / {total}"],
    sfVisualNoImage: ["No image", "画像なし"],
    sfVisualNoCands: ["Add candidate products first — feature visuals are chosen from them.", "先に候補商品を追加してください。特集ビジュアルは候補商品から選びます。"],
    sfVisualSold:    ["This image belongs to a sold-out product.", "この画像の商品は売り切れています。"],
    sfVisualDraft:   ["This image belongs to a draft product.", "この画像の商品は非公開です。"],
    sfVisualMissing: ["This image's product no longer exists.", "この画像の商品は存在しません。"],
    sfVisualBroken:  ["Selected image is unavailable.", "指定画像を利用できません。"],
    sfVisualKept:    ["A chosen image stays on show — only the product card is withdrawn.", "指定した画像は掲載を続けます。取り下げられるのは商品カードのみです。"],
    sfVisualCustom:  ["External image", "外部画像"],
    sfVisualCustomNote: ["A photograph of your own — styling, a rack, a detail. Paste an image address.", "スタイリングやラック、ディテールなど独自の写真。画像のURLを入力してください。"],
    sfVisualCustomUse: ["Use this address", "このURLを使う"],
    sfSlotPrimary:   ["Primary (large)", "Primary（大）"],
    sfSlotSecondary: ["Secondary (upper right)", "Secondary（右上）"],
    sfSlotTertiary:  ["Tertiary (lower right)", "Tertiary（右下）"],
    sfViewInShop:    ["View in shop", "ショップで見る"],
    sfSavedToast:    ["Feature saved", "特集を保存しました"],
    sfDeletedToast:  ["Feature deleted", "特集を削除しました"],
    sfDuplicatedToast:["Feature duplicated as a draft", "特集を下書きとして複製しました"],
    sfNotFound:      ["That feature no longer exists.", "この特集は存在しません。"]
  };

var ADMPAIRS = [
 [
  "LOADING ADMIN",
  "管理画面を読み込み中"
 ],
 [
  "STORE ADMINISTRATION",
  "ストア管理"
 ],
 [
  "Sign in",
  "サインイン"
 ],
 [
  "Email address",
  "メールアドレス"
 ],
 [
  "Password",
  "パスワード"
 ],
 [
  "Remember me",
  "ログイン状態を保持"
 ],
 [
  "Forgot password?",
  "パスワードをお忘れですか？"
 ],
 [
  "DEMO CREDENTIALS",
  "デモ用アカウント"
 ],
 [
  "Fill credentials",
  "デモ情報を入力"
 ],
 [
  "← Back to the public store",
  "← ストアに戻る"
 ],
 [
  "ADMIN CONSOLE",
  "管理コンソール"
 ],
 [
  "View Store",
  "ストアを見る"
 ],
 [
  "Logout",
  "ログアウト"
 ],
 [
  "NOTIFICATIONS",
  "通知"
 ],
 [
  "Nothing needs attention.",
  "対応が必要な項目はありません。"
 ],
 [
  "Settings",
  "設定"
 ],
 [
  "View store",
  "ストアを見る"
 ],
 [
  "Recently updated products",
  "最近更新した商品"
 ],
 [
  "ALL →",
  "すべて →"
 ],
 [
  "NO",
  "画像"
 ],
 [
  "IMG",
  "なし"
 ],
 [
  "Low stock &amp; sold out",
  "在庫僅少・売り切れ"
 ],
 [
  "Every published piece is in stock.",
  "公開中の商品はすべて在庫があります。"
 ],
 [
  "Edit",
  "編集"
 ],
 [
  "Recently registered customers",
  "最近登録した顧客"
 ],
 [
  "Content awaiting publication",
  "公開待ちのコンテンツ"
 ],
 [
  "No drafts or scheduled posts.",
  "下書き・予約投稿はありません。"
 ],
 [
  "Open",
  "開く"
 ],
 [
  "Publish",
  "公開する"
 ],
 [
  "Recent administrative activity",
  "最近の管理操作"
 ],
 [
  "Store details",
  "ストア情報"
 ],
 [
  "Store name",
  "ストア名"
 ],
 [
  "Tagline",
  "タグライン"
 ],
 [
  "Contact email",
  "連絡先メールアドレス"
 ],
 [
  "Telephone",
  "電話番号"
 ],
 [
  "Studio address",
  "所在地"
 ],
 [
  "Console preferences",
  "管理画面の設定"
 ],
 [
  "Rows per page",
  "1ページあたりの表示件数"
 ],
 [
  "Low-stock threshold",
  "在庫僅少のしきい値"
 ],
 [
  "Published pieces at or below this quantity appear in the dashboard warning list.",
  "この数量以下の公開商品が、ダッシュボードの警告一覧に表示されます。"
 ],
 [
  "Notify me about unpublished drafts",
  "未公開の下書きを通知する"
 ],
 [
  "Notify me about low stock",
  "在庫僅少を通知する"
 ],
 [
  "Account",
  "アカウント"
 ],
 [
  "This is a prototype session. Authentication is simulated and no credentials leave your browser.",
  "これはプロトタイプのセッションです。認証は擬似的なもので、入力情報がブラウザの外に送信されることはありません。"
 ],
 [
  "Sign out",
  "サインアウト"
 ],
 [
  "Demo data",
  "デモデータ"
 ],
 [
  "Every change you make is stored in this browser only. Resetting restores the original 30 products, 25 customers and 10 articles, and discards all edits.",
  "変更はこのブラウザ内にのみ保存されます。リセットすると商品30点・顧客25名・記事10本の初期状態に戻り、編集内容はすべて破棄されます。"
 ],
 [
  "Reset demo data",
  "デモデータをリセット"
 ],
 [
  "Export snapshot (JSON)",
  "スナップショットを書き出す（JSON）"
 ],
 [
  "Admin sections",
  "管理メニュー"
 ],
 [
  "Open navigation",
  "メニューを開く"
 ],
 [
  "Breadcrumb",
  "パンくずリスト"
 ],
 [
  "Notifications",
  "通知"
 ],
 [
  "Close notifications",
  "通知を閉じる"
 ],
 [
  "No photograph yet",
  "写真は未登録です"
 ],
 [
  "Close navigation",
  "メニューを閉じる"
 ],
 [
  "Dismiss notification",
  "通知を閉じる"
 ],
 [
  "LOADING CUSTOMERS",
  "顧客を読み込み中"
 ],
 [
  "Connecting to the store database…",
  "ストアのデータに接続しています…"
 ],
 [
  "Search customers",
  "顧客を検索"
 ],
 [
  "SORT",
  "並び替え"
 ],
 [
  "Filters",
  "絞り込み"
 ],
 [
  "Export CSV",
  "CSVで書き出す"
 ],
 [
  "REGISTERED AFTER",
  "登録日（以降）"
 ],
 [
  "Clear all",
  "すべてクリア"
 ],
 [
  "Export selected",
  "選択分を書き出す"
 ],
 [
  "Clear selection",
  "選択を解除"
 ],
 [
  "No customers match this search",
  "条件に一致する顧客はいません"
 ],
 [
  "Search by name, email address, telephone number or customer ID — or clear the filters to see all accounts.",
  "氏名・メールアドレス・電話番号・顧客IDで検索できます。すべての顧客を表示するには絞り込みを解除してください。"
 ],
 [
  "Clear search &amp; filters",
  "検索と絞り込みを解除"
 ],
 [
  "Registered customers",
  "登録顧客"
 ],
 [
  "Open customer",
  "顧客を開く"
 ],
 [
  "Previous",
  "前へ"
 ],
 [
  "Next",
  "次へ"
 ],
 [
  "Customer not found",
  "顧客が見つかりません"
 ],
 [
  "This account may have been deleted, or the link is out of date.",
  "このアカウントは削除された可能性があります。またはリンクが古くなっています。"
 ],
 [
  "Back to customers",
  "顧客一覧に戻る"
 ],
 [
  "Profile",
  "プロフィール"
 ],
 [
  "Cancel",
  "キャンセル"
 ],
 [
  "Internal status",
  "社内ステータス"
 ],
 [
  "Active",
  "有効"
 ],
 [
  "Inactive",
  "休止"
 ],
 [
  "Blocked",
  "停止"
 ],
 [
  "Consents to marketing email",
  "メール配信に同意"
 ],
 [
  "Tags",
  "タグ"
 ],
 [
  "No tags yet.",
  "タグはまだありません。"
 ],
 [
  "Add a tag",
  "タグを追加"
 ],
 [
  "Purchase history",
  "購入履歴"
 ],
 [
  "No orders recorded for this customer.",
  "この顧客の注文履歴はありません。"
 ],
 [
  "Internal notes",
  "社内メモ"
 ],
 [
  "Add a note",
  "メモを追加"
 ],
 [
  "Add note",
  "メモを保存"
 ],
 [
  "Delete",
  "削除"
 ],
 [
  "Save note",
  "メモを保存"
 ],
 [
  "No internal notes yet.",
  "社内メモはまだありません。"
 ],
 [
  "Summary",
  "概要"
 ],
 [
  "Actions",
  "操作"
 ],
 [
  "Export customer data",
  "顧客データを書き出す"
 ],
 [
  "Delete customer",
  "顧客を削除"
 ],
 [
  "← Back to all customers",
  "← 顧客一覧に戻る"
 ],
 [
  "Activity history",
  "操作履歴"
 ],
 [
  "Search name, email, telephone or customer ID…",
  "氏名・メール・電話・顧客IDで検索…"
 ],
 [
  "Bulk customer actions",
  "顧客の一括操作"
 ],
 [
  "Add tag to selected customers",
  "選択した顧客にタグを追加"
 ],
 [
  "Set status for selected customers",
  "選択した顧客のステータスを変更"
 ],
 [
  "Select all customers on this page",
  "このページの顧客をすべて選択"
 ],
 [
  "Visible only to store staff.",
  "店舗スタッフのみに表示されます。"
 ],
 [
  "Product not found",
  "商品が見つかりません"
 ],
 [
  "This piece may have been deleted, or the link is out of date.",
  "この商品は削除された可能性があります。またはリンクが古くなっています。"
 ],
 [
  "Back to products",
  "商品一覧に戻る"
 ],
 [
  "Search products",
  "商品を検索"
 ],
 [
  "CREATED AFTER",
  "作成日（以降）"
 ],
 [
  "UPDATED AFTER",
  "更新日（以降）"
 ],
 [
  "Unpublish",
  "非公開にする"
 ],
 [
  "New product",
  "商品を追加"
 ],
 [
  "Product archive",
  "商品アーカイブ"
 ],
 [
  "FEATURED",
  "特集"
 ],
 [
  "IMAGE",
  "画像"
 ],
 [
  "Basic information",
  "基本情報"
 ],
 [
  "Product name",
  "商品名"
 ],
 [
  "Product ID / SKU",
  "商品ID / SKU"
 ],
 [
  "Brand",
  "ブランド"
 ],
 [
  "Category",
  "カテゴリー"
 ],
 [
  "Subcategory",
  "サブカテゴリー"
 ],
 [
  "Price (JPY)",
  "価格（円）"
 ],
 [
  "Tax status",
  "税区分"
 ],
 [
  "Tax included",
  "税込"
 ],
 [
  "Tax excluded",
  "税抜"
 ],
 [
  "Not taxable",
  "非課税"
 ],
 [
  "Stock quantity",
  "在庫数"
 ],
 [
  "Publication status",
  "公開状態"
 ],
 [
  "Draft",
  "下書き"
 ],
 [
  "Published",
  "公開中"
 ],
 [
  "Sold out",
  "売り切れ"
 ],
 [
  "Archived",
  "アーカイブ済"
 ],
 [
  "Vintage information",
  "ヴィンテージ情報"
 ],
 [
  "Approximate year",
  "推定年代"
 ],
 [
  "Country of manufacture",
  "製造国"
 ],
 [
  "Material",
  "素材"
 ],
 [
  "Colour",
  "色"
 ],
 [
  "Size",
  "サイズ"
 ],
 [
  "Size notation on label",
  "ラベル表記のサイズ"
 ],
 [
  "Curator's note",
  "キュレーターの覚書"
 ],
 [
  "Product story",
  "商品の背景"
 ],
 [
  "Styling recommendation",
  "着こなしの提案"
 ],
 [
  "Measurements",
  "実寸"
 ],
 [
  "Condition",
  "状態"
 ],
 [
  "Condition grade",
  "状態グレード"
 ],
 [
  "Condition description",
  "状態の説明"
 ],
 [
  "Images",
  "画像"
 ],
 [
  "DESKTOP 3:4",
  "デスクトップ 3:4"
 ],
 [
  "MOBILE 1:1",
  "モバイル 1:1"
 ],
 [
  "No images yet. A published product needs at least one photograph.",
  "画像がありません。公開するには写真が1点以上必要です。"
 ],
 [
  "PRIMARY",
  "メイン"
 ],
 [
  "ALT TEXT",
  "代替テキスト"
 ],
 [
  "Primary",
  "メインに設定"
 ],
 [
  "Upload images",
  "画像をアップロード"
 ],
 [
  "Add archive placeholder",
  "アーカイブ画像を追加"
 ],
 [
  "Drag a tile to reorder. The first image is used on the shop grid.",
  "ドラッグして並び替えできます。1枚目がショップ一覧に使われます。"
 ],
 [
  "SEO &amp; publishing",
  "SEOと公開設定"
 ],
 [
  "URL slug",
  "URLスラッグ"
 ],
 [
  "Regenerate",
  "再生成"
 ],
 [
  "Meta title",
  "メタタイトル"
 ],
 [
  "Meta description",
  "メタディスクリプション"
 ],
 [
  "Publish date",
  "公開日"
 ],
 [
  "Featured collection",
  "特集コレクション"
 ],
 [
  "— None —",
  "— なし —"
 ],
 [
  "Autumn Archive",
  "秋のアーカイブ"
 ],
 [
  "Workwear Study",
  "ワークウェア考"
 ],
 [
  "Military Issue",
  "ミリタリー"
 ],
 [
  "Mended &amp; Repaired",
  "繕いと修理"
 ],
 [
  "Featured product",
  "特集商品"
 ],
 [
  "Appears in the Selected Pieces row on the store homepage.",
  "ストアのトップページの特集欄に表示されます。"
 ],
 [
  "Save as draft",
  "下書きとして保存"
 ],
 [
  "Preview",
  "プレビュー"
 ],
 [
  "Mark as sold out",
  "売り切れにする"
 ],
 [
  "Delete product",
  "商品を削除"
 ],
 [
  "Shop card preview",
  "ショップ表示のプレビュー"
 ],
 [
  "SOLD OUT",
  "売り切れ"
 ],
 [
  "You have unsaved changes",
  "保存していない変更があります"
 ],
 [
  "Leaving this editor will discard your edits to this product.",
  "編集画面を離れると、この商品の変更は破棄されます。"
 ],
 [
  "Keep editing",
  "編集を続ける"
 ],
 [
  "Save &amp; leave",
  "保存して離れる"
 ],
 [
  "Discard",
  "破棄する"
 ],
 [
  "STOREFRONT PREVIEW",
  "ストア表示プレビュー"
 ],
 [
  "DESKTOP",
  "デスクトップ"
 ],
 [
  "MOBILE",
  "モバイル"
 ],
 [
  "Close",
  "閉じる"
 ],
 [
  "CURATOR'S NOTE",
  "キュレーターの覚書"
 ],
 [
  "Search name, SKU, brand, material…",
  "商品名・SKU・ブランド・素材で検索…"
 ],
 [
  "Bulk actions",
  "一括操作"
 ],
 [
  "Move selected to category",
  "選択分をカテゴリーへ移動"
 ],
 [
  "Select all products on this page",
  "このページの商品をすべて選択"
 ],
 [
  "One line describing how this piece has aged.",
  "この一点がどう歳を重ねたかを一行で。"
 ],
 [
  "Where it came from, who wore it, what we did to it.",
  "どこで見つけ、誰が着て、私たちが何をしたか。"
 ],
 [
  "Entry not found",
  "記事が見つかりません"
 ],
 [
  "This entry may have been deleted, or the link is out of date.",
  "この記事は削除された可能性があります。またはリンクが古くなっています。"
 ],
 [
  "Back to news",
  "一覧に戻る"
 ],
 [
  "Search content",
  "記事を検索"
 ],
 [
  "Clear",
  "クリア"
 ],
 [
  "Archive",
  "アーカイブ"
 ],
 [
  "Clear search",
  "検索を解除"
 ],
 [
  "New entry",
  "記事を追加"
 ],
 [
  "NO IMAGE",
  "画像なし"
 ],
 [
  "Entry",
  "記事"
 ],
 [
  "Content type",
  "種別"
 ],
 [
  "Title",
  "タイトル"
 ],
 [
  "Author",
  "著者"
 ],
 [
  "Add tag",
  "タグを追加"
 ],
 [
  "Main image",
  "メイン画像"
 ],
 [
  "16:9 EDITORIAL CROP",
  "16:9 編集用トリミング"
 ],
 [
  "No main image yet.",
  "メイン画像がありません。"
 ],
 [
  "Upload a photograph or use an archive placeholder.",
  "写真をアップロードするか、アーカイブ画像をお使いください。"
 ],
 [
  "Image alt text",
  "画像の代替テキスト"
 ],
 [
  "Upload image",
  "画像をアップロード"
 ],
 [
  "Use archive placeholder",
  "アーカイブ画像を使う"
 ],
 [
  "Remove",
  "削除"
 ],
 [
  "Body",
  "本文"
 ],
 [
  "Related products",
  "関連商品"
 ],
 [
  "No products linked to this entry.",
  "この記事に紐づく商品はありません。"
 ],
 [
  "Link a product",
  "商品を紐づける"
 ],
 [
  "SEO title",
  "SEOタイトル"
 ],
 [
  "SEO description",
  "SEOディスクリプション"
 ],
 [
  "Publication",
  "公開設定"
 ],
 [
  "Publication date",
  "公開日"
 ],
 [
  "Featured entry",
  "注目記事"
 ],
 [
  "Pinned to the top of the public Journal page.",
  "公開ジャーナルの先頭に固定されます。"
 ],
 [
  "Delete entry",
  "記事を削除"
 ],
 [
  "JOURNAL PREVIEW",
  "ジャーナル プレビュー"
 ],
 [
  "Leaving the editor will discard your edits to this entry.",
  "編集画面を離れると、この記事の変更は破棄されます。"
 ],
 [
  "Search title, summary, author…",
  "タイトル・概要・著者で検索…"
 ],
 [
  "Bulk content actions",
  "コンテンツの一括操作"
 ],
 [
  "No cover image yet",
  "カバー画像は未登録です"
 ],
 [
  "Add a tag and press Enter",
  "タグを入力してEnterキー"
 ],
 [
  "Article body",
  "記事本文"
 ],
 [
  "Dashboard",
  "ダッシュボード"
 ],
 [
  "Products",
  "商品"
 ],
 [
  "Customers",
  "顧客"
 ],
 [
  "News",
  "お知らせ"
 ],
 [
  "News &amp; Journal",
  "お知らせ・ジャーナル"
 ],
 [
  "News & Journal",
  "お知らせ・ジャーナル"
 ],
 [
  " pieces in the archive",
  " 点をアーカイブに収録"
 ],
 [
  "Add a piece to the archive",
  "アーカイブに一点を追加します"
 ],
 [
  "Edit product",
  "商品を編集"
 ],
 [
  "Update archive record",
  "アーカイブの記録を更新します"
 ],
 [
  " registered accounts",
  " 件の登録アカウント"
 ],
 [
  "Customer",
  "顧客"
 ],
 [
  "Profile, orders and internal notes",
  "プロフィール・注文・社内メモ"
 ],
 [
  " entries",
  " 本の記事"
 ],
 [
  "Write a news post or journal article",
  "お知らせやジャーナル記事を書きます"
 ],
 [
  "Edit entry",
  "記事を編集"
 ],
 [
  "Update published or draft content",
  "公開中または下書きの内容を更新します"
 ],
 [
  "Store details, console preferences and demo data",
  "ストア情報・管理画面の設定"
 ],
 [
  "Not found",
  "見つかりません"
 ],
 [
  "This admin page does not exist",
  "この管理ページは存在しません"
 ],
 [
  "ADMIN",
  "管理"
 ],
 [
  "PUBLISHED",
  "公開中"
 ],
 [
  "DRAFT",
  "下書き"
 ],
 [
  "ARCHIVED",
  "アーカイブ済"
 ],
 [
  "SCHEDULED",
  "公開予約"
 ],
 [
  "ACTIVE",
  "有効"
 ],
 [
  "INACTIVE",
  "休止"
 ],
 [
  "BLOCKED",
  "停止"
 ],
 [
  "TOTAL PRODUCTS",
  "商品総数"
 ],
 [
  "in the archive",
  "アーカイブ内"
 ],
 [
  "visible in the shop",
  "ショップに表示中"
 ],
 [
  "DRAFTS",
  "下書き"
 ],
 [
  "not yet public",
  "未公開"
 ],
 [
  "shown as unavailable",
  "販売終了として表示"
 ],
 [
  "TOTAL CUSTOMERS",
  "顧客総数"
 ],
 [
  "registered accounts",
  "登録アカウント"
 ],
 [
  "NEW THIS MONTH",
  "今月の新規"
 ],
 [
  "since 1 July",
  "7月1日以降"
 ],
 [
  "PUBLISHED ARTICLES",
  "公開記事"
 ],
 [
  "live on the site",
  "サイトに公開中"
 ],
 [
  "ARTICLE DRAFTS",
  "記事の下書き"
 ],
 [
  "awaiting review",
  "確認待ち"
 ],
 [
  " LEFT",
  " 残り"
 ],
 [
  " NEED ATTENTION",
  " 件 要対応"
 ],
 [
  "Enter the administrator email address.",
  "管理者のメールアドレスを入力してください。"
 ],
 [
  "Enter your password.",
  "パスワードを入力してください。"
 ],
 [
  "Signed in as ",
  "サインインしました: "
 ],
 [
  "Sign out of the admin console?",
  "管理コンソールからサインアウトしますか？"
 ],
 [
  "Unsaved work in an open editor will be lost. Store data stays in this browser.",
  "編集中の未保存の内容は失われます。ストアのデータはこのブラウザに残ります。"
 ],
 [
  "Reset all demo data?",
  "すべてのデモデータをリセットしますか？"
 ],
 [
  "Demo data restored to its original state.",
  "デモデータを初期状態に戻しました。"
 ],
 [
  "Snapshot exported as tsumugi-snapshot.json",
  "tsumugi-snapshot.json として書き出しました"
 ],
 [
  "Export failed in this browser.",
  "このブラウザでは書き出せませんでした。"
 ],
 [
  "Settings saved.",
  "設定を保存しました。"
 ],
 [
  "Confirm",
  "確認"
 ],
 [
  "Signing in…",
  "サインイン中…"
 ],
 [
  "A reset link would be sent to admin@tsumugi.archive. This is a prototype.",
  "admin@tsumugi.archive に再設定リンクを送信します。これはプロトタイプです。"
 ],
 [
  "just now",
  "たった今"
 ],
 [
  "m ago",
  "分前"
 ],
 [
  "h ago",
  "時間前"
 ],
 [
  "d ago",
  "日前"
 ],
 [
  "Inventory · check availability",
  "在庫 · 在庫状況を確認"
 ],
 [
  "Products · needs review",
  "商品 · 確認が必要"
 ],
 [
  "Customers · July 2026",
  "顧客 · 2026年7月"
 ],
 [
  "PRODUCT",
  "商品"
 ],
 [
  "BRAND",
  "ブランド"
 ],
 [
  "CATEGORY",
  "カテゴリー"
 ],
 [
  "ERA",
  "年代"
 ],
 [
  "SIZE",
  "サイズ"
 ],
 [
  "PRICE",
  "価格"
 ],
 [
  "STOCK",
  "在庫"
 ],
 [
  "STATUS",
  "ステータス"
 ],
 [
  "UPDATED",
  "更新"
 ],
 [
  "PUBLICATION",
  "公開状態"
 ],
 [
  "CONDITION",
  "状態"
 ],
 [
  "Recently updated",
  "更新が新しい順"
 ],
 [
  "Recently created",
  "登録が新しい順"
 ],
 [
  "Name A–Z",
  "名前順"
 ],
 [
  "Price: high to low",
  "価格が高い順"
 ],
 [
  "Price: low to high",
  "価格が安い順"
 ],
 [
  "Stock: low first",
  "在庫が少ない順"
 ],
 [
  "All statuses",
  "すべてのステータス"
 ],
 [
  "In stock",
  "在庫あり"
 ],
 [
  "Out of stock",
  "在庫なし"
 ],
 [
  "Any stock",
  "在庫を問わない"
 ],
 [
  "All categories",
  "すべてのカテゴリー"
 ],
 [
  "All brands",
  "すべてのブランド"
 ],
 [
  "All eras",
  "すべての年代"
 ],
 [
  "All sizes",
  "すべてのサイズ"
 ],
 [
  "Any condition",
  "状態を問わない"
 ],
 [
  "Any price",
  "価格を問わない"
 ],
 [
  "Excellent",
  "極美品"
 ],
 [
  "Very Good",
  "美品"
 ],
 [
  "Good",
  "良品"
 ],
 [
  "Fair",
  "可"
 ],
 [
  "Under ¥20,000",
  "¥20,000未満"
 ],
 [
  "Over ¥35,000",
  "¥35,000以上"
 ],
 [
  "View on store",
  "ストアで見る"
 ],
 [
  "Duplicate",
  "複製"
 ],
 [
  "Mark as sold",
  "売り切れにする"
 ],
 [
  "Duplicated as a new draft.",
  "下書きとして複製しました。"
 ],
 [
  "Product deleted.",
  "商品を削除しました。"
 ],
 [
  "Changes saved.",
  "変更を保存しました。"
 ],
 [
  "Draft saved.",
  "下書きを保存しました。"
 ],
 [
  "Marked as sold out.",
  "売り切れにしました。"
 ],
 [
  "No products match this search",
  "条件に一致する商品はありません"
 ],
 [
  "The archive is empty",
  "アーカイブは空です"
 ],
 [
  "NO RESULTS",
  "該当なし"
 ],
 [
  "Enter a price above zero.",
  "0より大きい価格を入力してください。"
 ],
 [
  "TROUSER FIELDS",
  "パンツの項目"
 ],
 [
  "TOP & OUTERWEAR FIELDS",
  "トップス・アウターの項目"
 ],
 [
  "Stains",
  "汚れ"
 ],
 [
  "Damage",
  "傷み"
 ],
 [
  "Repairs",
  "補修"
 ],
 [
  "Fading",
  "退色"
 ],
 [
  "Missing parts",
  "欠品"
 ],
 [
  "None found.",
  "ありません。"
 ],
 [
  "None.",
  "なし。"
 ],
 [
  "Minimal.",
  "わずか。"
 ],
 [
  "Waist",
  "ウエスト"
 ],
 [
  "Rise",
  "股上"
 ],
 [
  "Inseam",
  "股下"
 ],
 [
  "Hem width",
  "裾幅"
 ],
 [
  "Shoulder width",
  "肩幅"
 ],
 [
  "Chest width",
  "身幅"
 ],
 [
  "Body length",
  "着丈"
 ],
 [
  "Sleeve length",
  "袖丈"
 ],
 [
  "● UNSAVED CHANGES",
  "● 未保存の変更"
 ],
 [
  "○ ALL CHANGES SAVED",
  "○ すべて保存済み"
 ],
 [
  "UPDATED ",
  "更新 "
 ],
 [
  "NOT YET SAVED",
  "未保存"
 ],
 [
  "Update product",
  "商品を更新"
 ],
 [
  "Publish product",
  "商品を公開"
 ],
 [
  "Update published product",
  "公開中の商品を更新"
 ],
 [
  "Publish now",
  "今すぐ公開"
 ],
 [
  "Untitled piece",
  "無題の一点"
 ],
 [
  "No curator's note yet.",
  "キュレーターの覚書はまだありません。"
 ],
 [
  "No product story written yet.",
  "商品の背景はまだ書かれていません。"
 ],
 [
  "Zero stock — the storefront will show a sold-out state.",
  "在庫0 — ストアでは売り切れとして表示されます。"
 ],
 [
  "Vintage pieces are usually one of one.",
  "ヴィンテージは通常一点物です。"
 ],
 [
  "This removes the record permanently from the archive.",
  "アーカイブからこの記録を完全に削除します。"
 ],
 [
  "Recently registered",
  "登録が新しい順"
 ],
 [
  "Most orders",
  "注文数が多い順"
 ],
 [
  "Highest spend",
  "購入額が高い順"
 ],
 [
  "Last purchase",
  "最終購入が新しい順"
 ],
 [
  "NAME",
  "氏名"
 ],
 [
  "EMAIL",
  "メール"
 ],
 [
  "TELEPHONE",
  "電話番号"
 ],
 [
  "REGISTERED",
  "登録日"
 ],
 [
  "ORDERS",
  "注文"
 ],
 [
  "TOTAL SPENT",
  "購入合計"
 ],
 [
  "LAST PURCHASE",
  "最終購入"
 ],
 [
  "TAGS",
  "タグ"
 ],
 [
  "MKTG",
  "配信"
 ],
 [
  "YES",
  "はい"
 ],
 [
  "TAG",
  "タグ"
 ],
 [
  "MARKETING",
  "メール配信"
 ],
 [
  "Edit customer",
  "顧客を編集"
 ],
 [
  "Customer profile updated.",
  "顧客情報を更新しました。"
 ],
 [
  "Name",
  "氏名"
 ],
 [
  "Address",
  "住所"
 ],
 [
  "Country",
  "国"
 ],
 [
  "Tag removed.",
  "タグを削除しました。"
 ],
 [
  "Internal note added.",
  "社内メモを追加しました。"
 ],
 [
  "Note updated.",
  "メモを更新しました。"
 ],
 [
  "Delete this internal note?",
  "この社内メモを削除しますか？"
 ],
 [
  "The note and its author record will be removed.",
  "メモと作成者の記録が削除されます。"
 ],
 [
  "Note deleted.",
  "メモを削除しました。"
 ],
 [
  "Customer ID",
  "顧客ID"
 ],
 [
  "Purchases",
  "購入回数"
 ],
 [
  "Total spent",
  "購入合計"
 ],
 [
  "Average order",
  "平均注文額"
 ],
 [
  "Marketing",
  "メール配信"
 ],
 [
  "Consented",
  "同意済"
 ],
 [
  "Declined",
  "未同意"
 ],
 [
  "Restore account",
  "アカウントを復元"
 ],
 [
  "Disable account",
  "アカウントを停止"
 ],
 [
  "Account restored.",
  "アカウントを復元しました。"
 ],
 [
  "Account disabled.",
  "アカウントを停止しました。"
 ],
 [
  "Customer deleted.",
  "顧客を削除しました。"
 ],
 [
  "Customer record exported.",
  "顧客データを書き出しました。"
 ],
 [
  "Export is not available in this browser.",
  "このブラウザでは書き出せません。"
 ],
 [
  "Purchase",
  "購入"
 ],
 [
  " orders · ",
  " 件の注文 · "
 ],
 [
  " ORDERS · ",
  " 件の注文 · "
 ],
 [
  " SELECTED",
  " 件選択"
 ],
 [
  "SHOWING ",
  "表示中 "
 ],
 [
  "TYPE",
  "種別"
 ],
 [
  "JOURNAL",
  "ジャーナル"
 ],
 [
  "NEWS",
  "お知らせ"
 ],
 [
  "Title A–Z",
  "タイトル順"
 ],
 [
  "Preview on site",
  "サイトでプレビュー"
 ],
 [
  "Duplicated as a draft.",
  "下書きとして複製しました。"
 ],
 [
  "Moved to drafts.",
  "下書きに移動しました。"
 ],
 [
  "Archived.",
  "アーカイブしました。"
 ],
 [
  "Entry deleted.",
  "記事を削除しました。"
 ],
 [
  "No entries match this search",
  "条件に一致する記事はありません"
 ],
 [
  "No content yet",
  "コンテンツがありません"
 ],
 [
  "Unsaved changes…",
  "未保存の変更…"
 ],
 [
  "Autosave paused — fix validation",
  "自動保存を停止 — 入力を修正してください"
 ],
 [
  "Autosaved at ",
  "自動保存 "
 ],
 [
  "Saved at ",
  "保存 "
 ],
 [
  "Journal article",
  "ジャーナル記事"
 ],
 [
  "News post",
  "お知らせ"
 ],
 [
  "Heading 2",
  "見出し2"
 ],
 [
  "Heading 3",
  "見出し3"
 ],
 [
  "Insert link",
  "リンクを挿入"
 ],
 [
  "Insert image",
  "画像を挿入"
 ],
 [
  "Bulleted list",
  "箇条書き"
 ],
 [
  "Numbered list",
  "番号付きリスト"
 ],
 [
  "Link",
  "リンク"
 ],
 [
  "Image",
  "画像"
 ],
 [
  "Select the text you want to link first.",
  "先にリンクする文字を選択してください。"
 ],
 [
  "Link inserted — edit the URL in the body HTML if needed.",
  "リンクを挿入しました。必要ならHTMLでURLを編集してください。"
 ],
 [
  "● Unsaved changes",
  "● 未保存の変更"
 ],
 [
  "○ All changes saved",
  "○ すべて保存済み"
 ],
 [
  "○ New entry — not saved yet",
  "○ 新しい記事 — 未保存"
 ],
 [
  "Last updated ",
  "最終更新 "
 ],
 [
  "Never saved",
  "未保存"
 ],
 [
  "In the future — publishing will schedule this entry.",
  "未来の日付 — 公開すると予約投稿になります。"
 ],
 [
  "Live immediately once published.",
  "公開すると即時に反映されます。"
 ],
 [
  "Update published entry",
  "公開中の記事を更新"
 ],
 [
  "Scheduled for ",
  "公開予約 "
 ],
 [
  "Choose a future publication date to schedule this entry.",
  "予約するには未来の公開日を選んでください。"
 ],
 [
  "Entry unpublished.",
  "記事を非公開にしました。"
 ],
 [
  "This permanently removes the entry from the site and the console.",
  "サイトと管理画面から記事を完全に削除します。"
 ],
 [
  "Untitled entry",
  "無題の記事"
 ],
 [
  "All",
  "すべて"
 ],
 [
  "Journal",
  "ジャーナル"
 ],
 [
  "Scheduled",
  "公開予約"
 ],
 [
  "ID",
  "ID"
 ],
 [
  "Jump to section",
  "セクションへ移動"
 ],
 [
  "Autosave is paused until the first draft is saved.",
  "最初の下書きを保存するまで自動保存は行われません。"
 ],
 [
  "No changes yet",
  "変更はありません"
 ],
 [
  "Reveal email address",
  "メールアドレスを表示"
 ],
 [
  "Reveal telephone number",
  "電話番号を表示"
 ],
 [
  "Hide email address",
  "メールアドレスを隠す"
 ],
 [
  "Hide telephone number",
  "電話番号を隠す"
 ],
 [
  "Masked",
  "マスク中"
 ],
 [
  "Export customer records",
  "顧客データの書き出し"
 ],
 [
  "Missing fields",
  "未入力の項目"
 ],
 [
  "Publishes on",
  "公開日"
 ],
 [
  "Not yet public",
  "まだ公開されていません"
 ]
];

  /* keys are derived from the English text so template and dictionary always agree */
  function admSlug(en) {
    var words = String(en).replace(/&amp;/g, "and").replace(/[^A-Za-z0-9]+/g, " ").trim().split(" ");
    var camel = words.map(function (w, n) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join("");
    return "k" + camel.slice(0, 34);
  }
  var ADM2 = (function () {
    var out = {}, seen = {};
    // Keys stay derived from the raw English (with its entities) so existing
    // template references keep resolving; the displayed value is decoded.
    var decode = function (s) { return String(s).replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "’").replace(/&quot;/g, "”"); };
    for (var n = 0; n < ADMPAIRS.length; n++) {
      var k = admSlug(ADMPAIRS[n][0]);
      if (seen[k]) { seen[k]++; k = k + seen[k]; } else { seen[k] = 1; }
      out[k] = [decode(ADMPAIRS[n][0]), decode(ADMPAIRS[n][1])];
    }
    return out;
  })();


  // Re-evaluated when the runtime re-mounts a page: register once, never overwrite.
  if (P.__tsumugiinadminjs) return;
  P.__tsumugiinadminjs = true;
  P.ADM = ADM;
  P.ADMPAIRS = ADMPAIRS;
  P.ADM2 = ADM2;
})();
