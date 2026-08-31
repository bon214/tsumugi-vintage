/* TSUMUGI bilingual copy — record content
   Japanese for values that live in the data layer in English: taxonomy,
   product names, curator notes, provenance, article titles and bodies, and the
   per-garment editorial blocks composed from a product record.
   Load order: this file must run BEFORE tsumugi-i18n.js, which reads
   window.TSUMUGI_I18N_PARTS and exposes the public window.TSUMUGI_I18N API. */
(function () {
  "use strict";
  var P = (window.TSUMUGI_I18N_PARTS = window.TSUMUGI_I18N_PARTS || {});
  /* ---- taxonomy shared by both surfaces ---- */
  var TAX = {
    Craft: "手仕事", Sourcing: "仕入れ", Studio: "スタジオ",
    Releases: "公開のお知らせ", Announcements: "お知らせ", Events: "催し", Guides: "手引き",
    Essays: "随筆",
    Outerwear: "アウター", Knitwear: "ニット", Shirts: "シャツ", Shirting: "シャツ", Trousers: "パンツ",
    Sweatshirts: "スウェット", Accessories: "小物", Footwear: "靴", Denim: "デニム",
    Excellent: "極美品", "Very Good": "美品", Good: "良品", Fair: "可",
    Active: "有効", Inactive: "休止", VIP: "VIP", Blocked: "停止",
    Paid: "支払済", Pending: "保留", Refunded: "返金済",
    journal: "ジャーナル", news: "お知らせ",
    Arrivals: "入荷", arrivals: "入荷",
    Shoulder: "肩幅", Chest: "身幅", Length: "着丈", Sleeve: "袖丈",
    Waist: "ウエスト", Rise: "股上", Inseam: "股下", Hem: "裾幅"
  };

  /* ---- product names (public site shows these in Japanese) ---- */
  var PROD = {
    "Reverse Weave Crewneck": "リバースウィーブ クルーネック",
    "Reverse Weave Hooded Sweatshirt": "リバースウィーブ フーデッドスウェット",
    "Synchilla Snap-T Pullover": "シンチラ スナップT プルオーバー",
    "Retro-X Deep Pile Fleece": "レトロX ディープパイルフリース",
    "Baggies Shorts": "バギーズ ショーツ",
    "Maine Warden's Parka": "メイン ウォーデンパーカ",
    "Waxed Field Coat": "ワックスド フィールドコート",
    "Norwegian Wool Sweater": "ノルウェージャン ウールセーター",
    "Oxford Button-Down Shirt": "オックスフォード ボタンダウンシャツ",
    "Twill Chino Trouser": "ツイル チノトラウザー",
    "Country Down Vest": "カントリー ダウンベスト",
    "501 Redline Selvedge": "501 レッドライン セルビッジ",
    "517 Bootcut Jean": "517 ブーツカット ジーンズ",
    "Type III Trucker Jacket": "タイプIII トラッカージャケット",
    "Detroit Duck Jacket": "デトロイト ダックジャケット",
    "Double Knee Duck Pant": "ダブルニー ダックパンツ",
    "Blanket-Lined Chore Coat": "ブランケットライニング カバーオール",
    "M-47 Cotton Twill Trouser": "M-47 コットンツイル トラウザー",
    "M-65 Field Jacket": "M-65 フィールドジャケット",
    "M59 Field Shirt": "M59 フィールドシャツ",
    "Bundeswehr Moleskin Trouser": "ドイツ軍 モールスキン トラウザー",
    "Moleskin Work Jacket": "モールスキン ワークジャケット",
    "Cotton Twill Work Jacket": "コットンツイル ワークジャケット",
    "Railway Denim Jacket": "レイルウェイ デニムジャケット",
    "Windrunner Jacket": "ウィンドランナー ジャケット",
    "ACG Fleece Pullover": "ACG フリースプルオーバー",
    "Goose Down Vest": "グースダウン ベスト",
    "Skyliner Down Jacket": "スカイライナー ダウンジャケット",
    "Heavy Cotton Chore Coat": "ヘビーコットン カバーオール",
    "Sashiko Stitched Haori": "刺し子 羽織"
  };

  /* ---- curator notes (public site shows these in Japanese) ---- */
  var NOTE = {
    "Even fade across the body, with the ribbing still springy at the cuffs and hem. The flock lettering has cracked but is not lifting.": "身頃全体に均一な褪色があります。袖と裾のリブには弾力が残り、フロックのロゴはひび割れていますが剥がれてはいません。",
    "The ecru has warmed unevenly at the shoulders. The hood stands on its own and the drawcord is the original flat cord.": "エクリュは肩を中心にわずかに斑に日焼けしています。フードは支えなしで立ち、ドローコードはオリジナルの平紐です。",
    "Pile is flattened across the chest and slightly greyed at the collar. All four snaps work and hold.": "胸のあたりのパイルが寝ており、襟元はわずかにグレーがかっています。スナップは四つすべて機能します。",
    "The deep pile has faded to a dry-grass tone at the sleeves, while the shell panels at the shoulder are unworn. It sheds nothing after a wash.": "深いパイルは袖から枯れ草のような色に褪せていますが、肩のシェル部分に着用感はありません。洗っても毛が抜け落ちません。",
    "Quick-dry nylon, soft and quiet now. The webbing belt has faded a shade lighter than the body.": "速乾ナイロンはやわらかく、音の立たない状態になっています。ウェビングベルトは身頃より一段明るく褪せています。",
    "Heavy cotton shell over a wool-lined body; the hood keeps its shape without wire. Storm cuffs are intact and still elastic.": "厚手のコットンシェルにウールの裏地。フードは芯なしでも形を保ちます。ストームカフは伸びも残り健全です。",
    "The wax has darkened along the seams. Cuffs are worn pale at the edge; the corduroy collar has no bald patches.": "ワックスが縫い目に沿って濃く沈んでいます。袖口は端が白く擦れていますが、コーデュロイの襟に毛落ちはありません。",
    "Dense wool, felted a little at the underarms. The shoulders are still square and the pattern has not pulled out of line.": "目の詰まったウールで、脇下がわずかに縮絨しています。肩の線は真っすぐで、柄の歪みもありません。",
    "Oxford cloth washed thin and soft; the collar rolls without a stand. One faint spot beside the second placket button.": "オックスフォード生地は洗いを重ねて薄くやわらかくなり、襟は芯なしで自然にロールします。前立ての第二ボタン脇に薄いシミが一箇所。",
    "Broken-in twill with a crease set into the front of the leg. Cuffed once by a previous owner and left that way.": "履き込まれたツイルで、前身の折り目が定着しています。前の持ち主が一度裾を折り上げ、そのままにされていました。",
    "The baffles are sound and the down lofts overnight after a wash. The leather zip pull has darkened where it was held.": "バッフルは健全で、洗濯後も一晩で羽毛が戻ります。革のジッププルは握られていた場所だけ黒ずんでいます。",
    "Fade concentrated at the thigh and behind the knee; the knees are soft but not thin. One back pocket has been rebuilt.": "太腿と膝裏に色落ちが集まっています。膝はやわらかくなっていますが、薄くはなっていません。バックポケットの一方は作り直されています。",
    "A light whisker fade at the front of the hip. Original hem, with the wear a heel leaves.": "腰の前面に浅いヒゲの色落ちがあります。裾はオリジナルで、踵の当たる部分に擦れが出ています。",
    "Indigo is even and dark, with almost no wear at the cuffs or elbows. The side tabs still adjust.": "インディゴは濃く均一で、袖口や肘にほとんど着用感がありません。サイドのアジャスターも機能します。",
    "Duck canvas bleached across the shoulders and stiff through the back, soft at the elbows and cuffs. The blanket lining is complete.": "ダックキャンバスは肩が日に焼け、背は張りを残しています。肘と袖口はやわらかい状態です。ブランケットの裏地は欠けなく残っています。",
    "Both knees were reinforced by a previous owner in navy thread. The canvas has thinned around the right hip pocket.": "両膝は前の持ち主が紺糸で補強しています。右の腰ポケット周りの生地が薄くなっています。",
    "Stiff at the shoulders and soft where a body has been. Two small mends in the hem lining, sewn in a thread close to the plaid.": "肩は張りを残し、体に触れていた場所はやわらかくなっています。裾の裏地に、チェックに近い色の糸で繕われた箇所が二つあります。",
    "Wide through the thigh with a cinch back. The stencilled size marks are still legible inside the waistband.": "腿にゆとりのある太い仕立てで、背にはシンチが付きます。ウエスト裏のステンシルのサイズ表記は今も読めます。",
    "The sateen has faded unevenly, more on the left sleeve. All four pockets and the collar zip are sound, and the hood is present.": "サテンの褪せ方は斑で、左袖のほうが強く出ています。四つのポケットと襟のジップは健全で、フードも付属します。",
    "Thin cotton, nearly translucent at the elbows. It creases sharply and rolls up small.": "薄いコットンで、肘はほとんど透けています。皺がはっきり出て、小さく丸められます。",
    "Moleskin brushed soft, closer to suede than to cotton. The factory press is still in the seams.": "起毛したモールスキンはやわらかく、綿よりスエードに近い手触りです。縫い目には工場の折りが残っています。",
    "Bleached unevenly from black to a pale stone colour, with the original black still visible under the collar. Three patch pockets, no lining.": "黒から淡い石の色へ、斑に褪せています。襟の裏には元の黒が残っています。貼りポケット三つ、裏地はありません。",
    "French blue twill with no wear at the cuffs. Heavy metal buttons and generous armholes.": "フレンチブルーのツイルで、袖口に着用感はありません。重い金属ボタンと、ゆとりのある袖付けです。",
    "The indigo has gone grey-blue overall. A company stencil is faint but readable on the left chest.": "インディゴは全体に灰みの青へ変わっています。左胸には社名のステンシルが薄く、しかし読める状態で残っています。",
    "The nylon has gone soft and quiet. The chevron is crisp and the cuff elastic still returns.": "ナイロンはやわらかく、動いても音が立ちません。シェブロンは鮮明で、袖口のゴムも戻ります。",
    "Heavyweight fleece with the pile flattened at the forearms. The printed ACG logo has cracked across the middle.": "厚手のフリースで、前腕のパイルが寝ています。プリントのACGロゴは中央からひび割れています。",
    "The baffles hold and the fill lofts after a wash. Snap front complete; one hand pocket has a loose stitch at the opening.": "バッフルは健全で、洗濯後に羽毛が戻ります。前のスナップは欠けなく、ハンドポケットの片方の口に糸のゆるみがあります。",
    "Light for the warmth it gives. The shell has gone slightly matte and the collar snaps are all present.": "暖かさに対して軽い一着です。シェルはわずかにマットになり、襟のスナップはすべて揃っています。",
    "Boxy through the body with a deep armhole. Heavy cotton, faded half a tone at the front placket.": "箱型の身に深い袖付け。厚手のコットンで、前の合わせが半段ほど褪せています。",
    "Hand-stitched sashiko repairs cover most of the back panel. The indigo is uneven and the cloth is thin at both shoulders.": "手縫いの刺し子補修が背面のほとんどを覆っています。藍の色は斑で、両肩の布が薄くなっています。"
  };

  /* ---- journal & news titles/summaries (public site, Japanese) ---- */
  var ART = {
    "How much of a repair we leave showing": "見える補修を、どこまで残すか",
    "Why we do not hide a sashiko repair, and what we decide before any thread goes in.": "刺し子で繕った箇所を隠さない理由と、糸を入れる前に決めていること。",
    "A week in Hokkaido, looking for wool": "ウールを探して、北海道の一週間",
    "Five towns, what we looked at, and what we decided not to buy.": "五つの町で見たもの、そして買わないと決めたもの。",
    "What a label tells you, and what it does not": "ラベルから分かること、分からないこと",
    "Union tags, care symbols and country marks — how far they narrow a date, and where they stop.": "ユニオンタグ、洗濯表示、原産国表記。年代をどこまで絞れて、どこで止まるか。",
    "Photographing a garment in the colour it actually is": "服の色をそのまま撮るために",
    "Why we shoot by the window, and the rules we keep while doing it.": "窓辺で撮る理由と、撮影で守っている決まりごと。",
    "Washing a forty-year-old sweater": "四十年前のセーターを洗う",
    "Cold water, flat drying, and the decision not to wash at all.": "冷水、平干し、そして洗わないという判断について。",
    "August opening hours": "8月の営業時間について",
    "Our opening days change through Obon week. Online orders ship as usual.": "お盆の期間は営業日が変わります。オンラインのご注文は通常どおり発送します。",
    "Autumn arrivals from 12 September": "秋の入荷、9月12日から",
    "Sixty pieces, mostly outerwear, published from 11:00 on 12 September.": "アウター中心に60点を、9月12日11時から公開します。",
    "Repair consultations — first Saturday of the month": "修理のご相談 — 毎月第一土曜日",
    "Bring one garment. We will look at it with you and say what can be mended.": "一着お持ちください。一緒に状態を拝見し、直せるかどうかをお話しします。",
    "An unworn garment tells us the least": "未使用の服が、いちばん分からない",
    "Why deadstock leaves us with the least to describe.": "デッドストックについて書けることが、いちばん少ない理由。",
    "We are looking for help with measuring and photography": "採寸と撮影を手伝ってくださる方を探しています",
    "Two days a week at the Kirigaya shop: measuring, photography and record-keeping.": "霧ヶ谷の店舗で週2日。採寸、撮影、記録を担当していただきます。",
    "archive": "アーカイブ",
    "arrivals": "入荷",
    "craft": "手仕事",
    "shop": "店のこと",
    "notice": "お知らせ",
    "R. Seo": "瀬尾 遼",
    "TSUMUGI Studio": "TSUMUGI 編集部"
  };

  /* Japanese article bodies, keyed by the English title held in the record. */
  var ART_BODY = {
    "How much of a repair we leave showing": "<p>繕うことは、元に戻すことではありません。穴のあいた服の選択肢は「傷んだ状態」と「新品」のあいだにあるのではなく、どんな履歴を見えるかたちで残すか、という選択です。</p><h3>糸を入れる前に決めること</h3><p>まず、その補修が構造的に必要なものか、見た目のためのものかを決めます。判断は生地を光に透かすところから始めます。織り目の向こうが見えるほど薄くなっていれば、あと一季で裂ける場所です。先日の刺し子羽織は、背の中心から肩へ向かって三十センチほどがその状態でした。同じ厚みの古い木綿を裏に当て、五ミリ間隔で刺して押さえています。</p><p>一方、三十年変化していない小さなピンホールには、たいてい何もしません。穴の縁が固く落ち着いていれば、そこから広がることは稀です。糸を入れれば、かえってその周囲に力がかかります。</p><p>縫う場合は、藍かエクリュの木綿糸を使います。生地に近い色ですが、埋もれてしまわない色です。手で触れば必ず分かるのですから、目でも分かるほうがいいと考えています。ミシンは使いません。手で刺せば、糸の張りを一針ずつ生地に合わせられます。</p><p>どの補修が当店のもので、どれが服に元からあったものかは、商品ページに書き分けています。前の持ち主の仕事も、しっかりしていればそのまま残します。私たちの手より良いことも、しばしばあります。</p>",
    "A week in Hokkaido, looking for wool": "<p>七日間で五つの町、二年間開けられていなかった店が一軒。持ち帰ったのは十四点で、旅の費用には届きませんでした。</p><p>一週間の大半は、買わない時間です。肩の仕立てが美しいウールのコートは、湿ったまま保管されていて、洗っても抜けない匂いが残っていました。裏地を剥がして嗅げば分かります。カビは生地の内側にまで入っていました。ノルウェーのセーター二着はアクリルの毛糸で繕われていて、解くことはできますが、提示された値段では引き取れませんでした。</p><h3>持ち帰ったもの</h3><p>閉店する洋品店から、紙のサイズタグが付いたままのセーターを四点。段ボールの底にあったため、上のものだけが日に焼けていました。ポケットが破れた、直せるグレーのブランケットコートを一点。そして父親の家を片づけていた方から、譲る前に一着ずつ説明を聞かせてほしいと言われたフィールドジャケットを三点。どこで着ていたか、なぜ三着あるのか。一時間ほど話を聞きました。</p><p>仕入れで見ているのは、年代よりも保管の状態です。良い服が悪い場所に十年あれば戻りませんが、普通の服が良い場所に三十年あれば、まだ着られます。</p><p>洗い、採寸し、撮影を終えたものから、来月のあいだに順に掲載します。</p>",
    "What a label tells you, and what it does not": "<p>ラベルは、服の来歴に最短で近づく手がかりであり、いちばん簡単に間違える場所でもあります。</p><h3>読む価値のある三つ</h3><ul><li>ユニオンラベル。意匠が何度か変わっているので、タグそのものが年代の幅を示します。書体と地色の組み合わせが手がかりです。</li><li>洗濯表示。統一された記号が導入された時期は国ごとに違い、ある年代を除外できることがあります。記号がないこと自体も情報です。</li><li>製造国。ブランドと組み合わせて初めて意味を持ちます。生産地が移った年が分かっていれば、ラベルもそれに従います。</li></ul><p>先日のシャツは、この三つがそろって食い違っていました。タグの書体は七〇年代、洗濯表示は八〇年代以降のもの。おそらく古いタグが在庫として残っていた工場のものです。こういうとき、私たちは新しい方に合わせて年代を書きます。</p><p>裾や脇の縫い代に、洗濯表示とは別の細い布札が残っていることもあります。検品の番号か、工場の班の記号です。年代は分かりませんが、量産の現場を通った証拠にはなります。こうした小さな札は、切らずに残しています。</p><p>ラベルは製造年を教えてくれません。在庫は倉庫で眠り、古いラベルは作られたずっとあとまで使われます。タグから分かるのは、たいてい五年から十年の幅です。</p><p>ですから、ラベルが裏づける範囲までを書き、それ以上は書きません。幅が広ければ広いと書き、タグが失われていたり読めない場合は「不明」と書きます。それは服の欠点ではありません。</p>",
    "Photographing a garment in the colour it actually is": "<p>ここに並ぶ写真はすべて、二階の北側の窓のそばで、午前十時から午後二時ごろのあいだに撮っています。フラッシュも定常光も使いません。</p><p>スタジオの光は服を売ります。織り目を埋め、褪せた綿をもう持っていない色に近づけ、生地の重さを伝える影を消してしまいます。窓の光は、美しくは見えませんが、役には立ちます。ウールの起毛は、斜めから当たる光でしか見えません。</p><h3>守っている決まりごと</h3><ul><li>光源は一つ。前から光を返しません。影が消えると、厚みも消えます。</li><li>ホワイトバランスはその日のグレーカードで一度合わせ、一枚ごとには変えません。同じ日の服は、同じ条件で並びます。</li><li>明るさの部分補正、彩度の追加、シミの除去はしません。服にあるものは、写真にもあります。</li></ul><p>撮る順番も決めています。まず正面を、床に置いたまま真上から。次に生地を近くから。最後に、着た状態を一枚。傷みのある箇所は、離れた写真と近い写真の両方に写します。どこにあるのかが分からなければ、近接写真は説明になりません。</p><p>撮影のあとは、その日の光の条件を短く書き留めます。晴れか曇りか、時刻、窓を開けていたかどうか。同じ服を再撮影することになったとき、前回に近い条件へ戻せます。色の記録は、写真だけでは足りません。</p><p>曇りの日は待ちます。掲載が一日遅れますが、届いた荷を開いたときに写真のとおりに見える理由は、そこにあります。</p>",
    "Washing a forty-year-old sweater": "<p>もっとも多く見る傷みは、虫食いではありません。熱いお湯、強い洗剤、そして急ぐことです。</p><h3>当店でしていること</h3><p>洗う前に、身幅と袖丈、着丈を測って書き留めます。戻す寸法が分からなければ、形は直せません。</p><p>水は冷水。中性のウール用洗剤を溶かし、揉まずに三十分ほど浸します。動かすのは最初と最後の一度だけです。ウールが縮むのは温度差と摩擦で、洗剤ではありません。引き上げるときは身頃全体を支えてください。濡れたウールは、肩を持つと自らの重さで伸びます。水気はタオルで押して抜き、絞りません。</p><p>直射日光を避けて平干しし、まだ湿っているうちに形を整えます。測っておいた寸法に、静かに戻します。乾くまでに二日かかることもありますが、途中で吊るしてはいけません。</p><p>それでも縮んでしまったときは、湿らせたまま少しずつ引いて戻します。一度に伸ばすと繊維が切れるので、五ミリずつ、乾き具合を見ながら数時間かけます。完全には戻りません。だから最初の一回を、いちばん慎重に扱います。</p><p>そして、洗わないという判断が正しいことも多くあります。一晩風に当てるだけで、古い服の匂いはほとんど抜けます。汗の跡が気になる脇だけを、部分的に洗う方法もあります。当店では店頭に出す前に一度洗いますので、そのあとは必要になるまで、そのままで構いません。</p>",
    "August opening hours": "<p>お盆の期間は、金曜から日曜のみの営業となります。時間は12:00—19:00です。8月13日（木）と20日（木）は休みます。</p><p>オンラインのご注文は通常どおり、2営業日以内に発送します。メールのお返事は、この期間だけ一日ほど遅れることがあります。</p><p>8月14日・15日は、建物東側の木階段を塗り直します。通行はできますが塗料が乾いていません。左側の手すりをお使いください。</p>",
    "Autumn arrivals from 12 September": "<p>9月12日11:00から、60点を三回に分けて公開します。はじめにアウター、次にトラウザー、最後にニットとシャツです。</p><p>大半は6月と7月の仕入れによるものです。フィールドジャケット、ワックスドコート三点、そして北海道の閉店する洋品店から譲り受けたノルウェーのセーターがまとまって入っています。</p><p>すべて一点物です。一着ずつ洗い、採寸し、撮影してから掲載するため、仕上がった順に並びます。</p><p>当日も通常どおり営業しています（木曜—日曜 12:00—19:00）。オンラインに掲載した服は、店頭でもご覧いただけます。</p>",
    "Repair consultations — first Saturday of the month": "<p>毎月第一土曜日の13:00—17:00、一着お持ちいただければ、一緒に状態を拝見します。</p><p>直すならどうするか、どこは触らないでおくか、費用はおよそいくらかをお伝えします。縫い目、ボタン、小さな穴ひとつ程度の作業は、その場で無料でお直しすることが多いです。それより大きなものはお見積りをお出しします。他店にお持ちいただいても構いません。</p><p>当店でお求めの品でなくても構いません。ご予約は不要です。二名お待ちの場合は、午後の遅い時間に改めてお越しいただくようお願いすることがあります。</p>",
    "An unworn garment tells us the least": "<p>デッドストックは売りやすく、書きにくい。まだ何も起きていないので、ラベルと寸法以外に報告することがありません。</p><p>着られた服は、持ち主の手がどこへ行ったか、どの縫い目が先に緩んだか、生地と糸のどちらが先に痩せたかを教えてくれます。たとえば同じ型のワークジャケットを続けて二着扱ったとき、どちらも右の腰ポケットの口だけが薄くなっていました。設計上そこに力がかかるということです。それは未使用の一着からは決して分かりません。</p><p>私たちがお渡しできる情報はそちらです。珍しいということではなく、長く持つことをすでに証明している、ということです。</p><h3>それでも扱う場合</h3><p>仕立てや生地を無傷の状態で見ておく価値があるときは、未使用のものも扱います。同じ服が三十年の使用を経る前にどう見えるか、その基準になるからです。工場の折り目が残っていれば、当時の縫製の順番まで読めることがあります。その場合は、着用されていないことを商品ページにはっきり書きます。</p><p>未使用の一着を並べて置くと、着られた側の変化がはっきりします。身幅は数ミリ広がり、袖は落ち、リブは緩む。その差は劣化というより、体に合わせて動いた記録です。値段はどちらも、そのときの相場で決めています。</p><p>ただ、私たちが薦めたいのは、ポケットを繕った一着です。もう一方がまだ問われていない問いに、すでに答えを出しています。</p>",
    "We are looking for help with measuring and photography": "<p>霧ヶ谷の店舗で週2日、木曜と金曜の11:00—18:00。新しい入荷の採寸、撮影、記載を、私たちのどちらかと一緒に担当していただく仕事です。</p><p>古着の経験は必要ありません。メジャーを根気よく当てられること、状態について飾らずに書けることが役に立ちます。</p><p>いちばんよく着ている服とその理由を、短く hello@tsumugi.archive までお送りください。いただいたお便りには、すべてお返事します。</p><p><em>この募集は終了しました。ご連絡くださった皆さま、ありがとうございました。</em></p>"
  };

  /* ---- product-page editorial: composed per garment from its own record ---- */
  var MAT_VOICE = {
    "Cotton Blend": ["The loops inside have gone soft and slightly matte — cotton that has been washed a few hundred times and lost nothing.", "裏の起毛はやわらかく、少し艶を失っています。何百回と洗われてなお、失われていないものがあります。"],
    "Fleece": ["Pile that has flattened only where a body pressed against it, which is a kind of record.", "体が触れていた場所だけパイルが寝ています。それも一種の記録です。"],
    "Nylon": ["Old nylon goes quiet with age. This one no longer rustles when you move.", "古いナイロンは、年を経るごとに静かになります。動いても音が立ちません。"],
    "Cotton": ["Plain cotton, thinned in the places hands go, thick everywhere else.", "手の触れる場所だけ薄くなり、ほかは厚みを保った、ただの綿です。"],
    "Waxed Cotton": ["The wax has crept into the seams and darkened them — exactly what should happen over thirty years.", "ワックスが縫い目に染みて、そこだけ濃く沈んでいます。三十年を経た布に起こるべきことです。"],
    "Wool": ["Wool that has felted a little at the underarms; the shoulders are still square.", "脇下がわずかに縮絨しています。肩の線はまだ真っすぐです。"],
    "Denim": ["Indigo leaves a garment in the order its owner used it. You can read the sequence here.", "インディゴは、持ち主の使った順に抜けていきます。その順番が読めます。"],
    "Down": ["Baffles that still fill overnight — down that was cleaned properly before it was ever sold.", "一晩で膨らみが戻るバッフル。売られる前に、きちんと洗われた羽毛です。"],
    "Duck Canvas": ["Duck canvas stiffens where it is not used and softens where it is. This one tells you what its owner did.", "使われない場所は硬く、使われた場所はやわらかく。持ち主の仕事が残っています。"],
    "Cotton Twill": ["Twill with a crease that set years ago and will not come out. We left it.", "何年も前に定着した折り目は、もう消えません。そのままにしています。"],
    "Moleskin": ["Moleskin, brushed by use into something closer to suede than to cotton.", "着込まれたモールスキンは、綿よりもスエードに近い手触りになります。"],
    "Cotton Sateen": ["Sateen that has faded unevenly, which we prefer to an even tone.", "斑に褪せたサテン。均一な色より、こちらを好みます。"]
  };
  var MAT_CARE = {
    "Cotton Blend": ["Cold hand wash, dried flat. Do not press the printed areas.", "冷水で手洗いし、平干ししてください。プリント部分にはアイロンを当てないでください。"],
    "Fleece": ["Wash alone in cold water without softener; softener closes the pile.", "柔軟剤を使わず、単独で冷水洗いを。柔軟剤はパイルを寝かせてしまいます。"],
    "Nylon": ["Cold wash, no tumble dryer. Heat is the only thing that will end this shell.", "冷水洗いで、乾燥機は避けてください。この生地を終わらせるのは熱だけです。"],
    "Cotton": ["Cold hand wash and dry in shade. Sun will take the last of the colour.", "冷水での手洗いと陰干しを。日光は残った色を持っていきます。"],
    "Waxed Cotton": ["Never wash. Wipe with cold water and let us rewax it when it dries out.", "洗わないでください。冷水で拭き、乾いてきた頃に当店でリワックスします。"],
    "Wool": ["Air it rather than wash it. Once a season, cold water and flat drying.", "洗うより、風に当ててください。季節ごとに一度、冷水で洗い平干しに。"],
    "Denim": ["Wash rarely, inside out, cold. The fade you have is yours to continue.", "裏返して、冷水で、たまに。この色落ちの続きは、あなたのものです。"],
    "Down": ["Wash cold with down detergent and dry fully; damp down loses loft.", "ダウン用洗剤で冷水洗いし、完全に乾かしてください。湿ったままでは膨らみが戻りません。"],
    "Duck Canvas": ["Cold wash, hang heavy. Never iron the seams flat.", "冷水洗いし、重みのまま吊り干しに。縫い目を潰すアイロンは避けてください。"],
    "Cotton Twill": ["Cold wash and hang. Press only if you want the crease back.", "冷水洗いして吊り干しに。折り目を戻したいときだけアイロンを。"],
    "Moleskin": ["Brush more than you wash. Cold water only when it is truly needed.", "洗うより、ブラシをかけてください。本当に必要なときだけ冷水で。"],
    "Cotton Sateen": ["Cold wash, dry in shade, no bleach of any kind.", "冷水洗いののち陰干し。漂白剤は一切使わないでください。"]
  };
  var SILHOUETTE = {
    "Sweatshirts": ["Cut short in the body and wide through the chest — it sits on the hip rather than below it, and the ribbing holds that line.", "身は短く、身幅は広い仕立てです。腰骨の上で止まり、リブがその位置を保ちます。"],
    "Knitwear": ["Dropped shoulder, deep armhole. It hangs from the shoulder rather than following the body.", "肩は落ち、袖付けは深く。体を追わず、肩から下に落ちるシルエットです。"],
    "Outerwear": ["Built to be worn over a knit, so the line stays straight and the sleeve keeps its room.", "ニットの上に羽織る前提の設計です。身は直線的で、袖にはゆとりが残ります。"],
    "Trousers": ["Straight from the hip with a full thigh; the hem falls without breaking on the shoe.", "腰から真っすぐ落ち、腿にゆとりがあります。裾は靴の上で折れずに落ちます。"],
    "Shirting": ["Boxy through the body with a collar that rolls on its own — good open, better layered.", "箱型の身に、自然にロールする襟。開けても、重ねても成立します。"]
  };
  var GRADE_VOICE = {
    "Excellent": ["Worn, but only lightly. Nothing here needed our hand.", "着用感はごく浅く、手を入れる必要のなかった一着です。"],
    "Very Good": ["Clearly used and clearly cared for. The structure is sound everywhere it matters.", "使われ、そして手をかけられてきた一着です。要となる部分の造りは健全です。"],
    "Good": ["Honestly worn. Some of it has been mended, and we have left those repairs visible.", "しっかり着られてきた一着です。補修された箇所は、そのまま見えるようにしています。"],
    "Fair": ["Heavily used. We kept it because what remains is still worth wearing.", "使い込まれた一着です。それでも着るに足るものが残っていたので、扱っています。"]
  };
  var DETAIL_CAPS = [
    ["Weave and density — how tightly this cloth was made.", "織りと密度 — この布がどれだけ密に作られていたか。"],
    ["Fastenings and stitching — buttons, zips, and the lines that hold them.", "留め具と縫製 — ボタン、ジップ、そしてそれを支える縫い目。"],
    ["Wear and mending — where the years show, and what we did about it.", "経年と補修 — 年月の出た場所と、そこに施した手当て。"]
  ];

  /* ---- curator stories (public site shows these in Japanese) ---- */
  var STORY = {
    "The tag and the reverse-weave construction place this in the mid-1980s, made in the USA. The side gussets and the crossgrain body that limits vertical shrinkage are both present.": "タグと縫製仕様から、1980年代半ばのアメリカ製と判断しています。脇のガゼットと、縦方向の縮みを抑える横目の身頃が確認できます。",
    "Made in the USA, before production moved. The single-line hem stitching and the dense early ribbing are consistent with the early 1990s.": "生産が移る前のアメリカ製です。裾の縫いが一本針であること、初期特有の密なリブから、1990年代初頭のものと見ています。",
    "Made in the USA, from the years before Synchilla production moved offshore. The label alone will not date it more closely than the mid-1990s.": "シンチラの生産が海外へ移る前のアメリカ製です。ラベルだけでは、1990年代半ばより細かく年代を絞ることはできません。",
    "Made in the USA. Beyond the label and the shell-and-pile construction, there is nothing left on the garment that would date it precisely.": "アメリカ製です。ラベルとシェル×パイルの構造以外に、年代を特定できる情報は残っていません。",
    "Late-1990s label. The mesh liner is intact and both hems are original.": "1990年代後半のラベルです。メッシュのライナーは健全で、裾は両側ともオリジナルです。",
    "Union label from Freeport, Maine. The zip pull is stamped and original.": "メイン州フリーポートのユニオンラベルが付いています。ジップのプルは刻印入りのオリジナルです。",
    "We rewaxed it once, by hand, before photographing. The brass zip runs cleanly and no repairs were needed.": "撮影前に一度、手作業でリワックスしています。真鍮のジップの動きは良く、補修の必要はありませんでした。",
    "Made in Norway for L.L.Bean. The fibre content is on the label; the year is our estimate from the tag style.": "L.L.Bean向けにノルウェーで作られたものです。組成はラベルに記載があり、年代はタグの仕様からの推定です。",
    "Single-needle placket and an unlined collar. We cannot say where it was sewn — the country tag has been cut out.": "前立てはシングルニードル、襟は芯なしです。原産国のタグが切り取られているため、縫製国は判断できません。",
    "Hong Kong label. The left pocket bag was repaired in matching thread, neatly, by someone before us.": "香港製のラベルです。左の袋布が同色の糸で丁寧に補修されていました。私たちの手によるものではありません。",
    "Polo Country label. Down content is printed at the hem; the fill weight is not stated.": "ポロ カントリーのラベルです。羽毛の組成は裾に記載がありますが、封入量の表記はありません。",
    "Single-stitch, a red selvedge line at the outseam, no hidden rivets. The tab and patch place it in the early 1980s.": "シングルステッチ、外側の縫い目に赤耳、隠しリベットはありません。タブとパッチから1980年代初頭のものと判断しています。",
    "Made in the USA, orange tab. The right back pocket shows the outline of a wallet.": "アメリカ製、オレンジタブです。右の後ポケットには財布の形の跡が残っています。",
    "Made in the USA. It has been washed only a few times, so there is little on the garment to read beyond the label.": "アメリカ製です。洗いの回数が少なく、ラベル以外に読み取れる情報はほとんど残っていません。",
    "Union-made label. One front snap was replaced in our workroom; the rest are original.": "ユニオンメイドのラベルです。前のスナップを一つ、当店の作業場で交換しています。残りはオリジナルです。",
    "Made in Mexico. We left the earlier repairs exactly as they were.": "メキシコ製です。以前の補修は、そのまま残しています。",
    "Made in the USA. The main seams are triple-stitched; the corduroy collar has flattened on one side.": "アメリカ製です。主要な縫い目は三重縫い。コーデュロイの襟は片側だけ毛が寝ています。",
    "French issue. The stamp inside gives a size and a depot mark but no year, so 1978 is our estimate.": "フランス軍の支給品です。内側の判にはサイズと部隊の記号がありますが年式の記載はないため、1978年は推定です。",
    "The contract label is intact and readable, which is how the year is known. The liner is not included.": "コントラクトラベルが判読でき、そこから年式が分かります。ライナーは付属しません。",
    "Swedish issue, with a crown stamp inside. Two buttons have been replaced with period spares.": "スウェーデン軍の支給品で、内側に王冠の判があります。ボタン二つを、同時代の予備と交換しています。",
    "Bundeswehr issue with a stamped size chart inside. Washed a few times; as far as we can tell it was never worked in.": "ドイツ連邦軍の支給品で、内側にサイズ表の判があります。数回洗われた程度で、仕事に使われた形跡は見当たりません。",
    "The maker's label has washed out completely, so we can say only that it is French workwear of the kind made through the 1960s and 70s.": "メーカーのラベルは完全に消えており、1960〜70年代に作られたフランスのワークジャケットである、というところまでしか分かりません。",
    "Made in Digoin, France, according to the label. Nothing on it has been repaired or replaced.": "ラベルによれば、フランス・ディゴワン製です。補修や部品交換の跡はありません。",
    "Issued to railway staff; the stencil carries the company initials. No date is printed anywhere on the garment.": "鉄道会社の支給品で、ステンシルには社名の頭文字があります。年式の表記は服のどこにもありません。",
    "Made in Korea, according to the label. Cream and rust colourway, lining complete.": "ラベルによれば韓国製です。クリームと錆色の配色で、裏地は欠けなく残っています。",
    "Made in Taiwan. The half-zip runs smoothly and the chest pocket lining is intact.": "台湾製です。ハーフジップの動きは良く、胸ポケットの袋布も健全です。",
    "Down content is stated on the hem label. The country of manufacture is not printed.": "羽毛の組成は裾のラベルに記載があります。製造国の表記はありません。",
    "Made in Seattle, according to the label. No repairs, and the down has not migrated.": "ラベルによればシアトル製です。補修はなく、羽毛の偏りもありません。",
    "A mid-1990s Gap label. An ordinary garment, in ordinary good condition.": "1990年代半ばのGapのラベルです。特別なものではなく、ごく普通に良い状態の一着です。",
    "Mended by hand over a long period with indigo thread. We could not establish when or where it was made; the cloth is hand-woven.": "長い年月をかけて、藍の糸で手縫いの補修が重ねられてきた一着です。いつ、どこで作られたかは特定できませんでした。布は手織りです。"
  };


  /* ---- arrivals journals (written entries, not generated) ---- */
  ART["August Arrivals"] = "August Arrivals";
  ART["Twenty-two pieces, most of them out of one house in Nagano, and two we sent back."] =
    "二十二点。その多くは長野の一軒から。そして、お返しした二点について。";
  ART_BODY["August Arrivals"] =
    "<p>今月は二十二点です。その大半は長野の一軒から届きました。ご家族が家を片づけられた際のもので、仕事着、三世代分のシャツ、そして虫害のまったくないウールが、そのまま残されていました。</p>"
    + "<h3>引き取ったもの</h3>"
    + "<p>車を走らせた理由は、藍の作業着四点です。四点とも以前に手で繕われていて、その針目から、同じ人が同じ手つきで直し続けてきたことが分かります。洗いはかけましたが、縫い目は一つも解いていません。</p>"
    + "<p>綿のシャツもまとめて引き取りました。何の変哲もない一群ですが、何百回と洗われてなお、肩が四角いままです。探して見つかるものではありません。</p>"
    + "<h3>お返ししたもの</h3>"
    + "<p>コート二点は物置に保管されていて、匂いが表地ではなく中綿に入っていました。当店の手当てでは抜けないため、家財と一緒にお返ししています。</p>"
    + "<p>下に挙げた品から先に掲載しました。残りは、支度の整ったものから霧ヶ谷の店頭に並びます。</p>";

  ART["July Arrivals"] = "July Arrivals";
  ART["Fourteen pieces out of the Hokkaido week, and the first of the winter knitwear."] =
    "北海道での一週間から十四点。そして、冬のニットの最初の数点。";
  ART_BODY["July Arrivals"] =
    "<p>十四点、いずれも六月に北海道で過ごした一週間の仕入れです。あの旅の最後の分で、ほかはすでに売れたか、補修の順番を待っています。</p>"
    + "<h3>ニットについて</h3>"
    + "<p>閉店する洋品店から引き取ったノルウェーのセーターが四点、紙のサイズタグが付いたまま残っていました。未使用品で、当店では珍しいことです。商品ページにもその旨を書いています。着られていない服は、着られてきた服より語ることが少ないからです。</p>"
    + "<p>手元に置きたいと思ったのは、グレーのブランケットコートです。ポケットは当店で、裾の内側から取った共布で作り直しました。探せば分かる仕事です。</p>"
    + "<h3>サイズについて</h3>"
    + "<p>今月のものは、現在の表記より一つ大きめに出ます。各ページに平置きの実寸を載せていますので、タグではなくそちらをご覧ください。</p>";

  ART["June Arrivals"] = "June Arrivals";
  ART["A quiet month: nine pieces, and the reason there were not more."] =
    "静かな月でした。九点と、それ以上に増えなかった理由について。";
  ART_BODY["June Arrivals"] =
    "<p>九点です。二度の仕入れが空振りに終わりました。説明のできない服を三十点並べるより、きちんと書ける服を九点並べるほうがいい、と考えています。</p>"
    + "<p>届いたものは夏の綿が中心です。ファティーグパンツ、メーカーの印が洗い落ちたフランスの作業着が二点、そして肩ヨークがほとんど白まで褪せたシャンブレーのシャツ。</p>"
    + "<h3>補修について</h3>"
    + "<p>九点のうち三点は、すでに繕われた状態で届きました。三点ともそのまま残しています。どの補修が元からのもので、どれが当店の手によるものかは、商品ページに書き分けています。</p>"
    + "<p>残りの時間は、すでに店にある服の撮影に充てました。外からは見えませんが、仕事の大半はそこにあります。</p>";

  // Re-evaluated when the runtime re-mounts a page: register once, never overwrite.
  if (P.__tsumugiincontentjs) return;
  P.__tsumugiincontentjs = true;
  P.TAX = TAX; P.PROD = PROD; P.NOTE = NOTE; P.ART = ART; P.ART_BODY = ART_BODY;
  P.MAT_VOICE = MAT_VOICE; P.MAT_CARE = MAT_CARE; P.SILHOUETTE = SILHOUETTE;
  P.GRADE_VOICE = GRADE_VOICE; P.DETAIL_CAPS = DETAIL_CAPS; P.STORY = STORY;
})();
