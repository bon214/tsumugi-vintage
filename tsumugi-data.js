/* TSUMUGI shared mock data layer — public site + admin app both read/write this.
   Persisted to localStorage. Classic script; exposes window.TSUMUGI_STORE. */
(function () {
  "use strict";
  // Each DC loads this script from its own helmet. Only ever build one store:
  // a second instance would own a separate db + event bus, so toasts, confirm
  // dialogs and live updates raised by child screens reached nobody.
  if (window.TSUMUGI_STORE) return;
  var KEY = "tsumugi.db.v6";
  var LEGACY_KEYS = ["tsumugi.db.v5", "tsumugi.db.v4", "tsumugi.db.v3"];
  var SESSION = "tsumugi.session.v1";

  var U = function (id, w) { return "https://images.unsplash.com/photo-" + id + "?auto=format&fit=crop&q=72&w=" + w; };
  // Prototype imagery. Free-licence photographs grouped by garment type, so a
  // record is never illustrated by something from another category. Each pool is
  // ordered front / back / fabric detail / fit.
  var IMG = {
    sweat:   ["1620799140408-edc6dcb6d633","1556905055-8f358a7a47b2"],
    knit:    ["1434389677669-e08b4cac3105","1523381210434-271e8be1f52b"],
    fleece:  ["1620799140408-edc6dcb6d633","1434389677669-e08b4cac3105"],
    jacket:  ["1591047139829-d91aecb6caea","1512436991641-6745cdb1723f","1544022613-e87ca75a784a"],
    field:   ["1544022613-e87ca75a784a","1512436991641-6745cdb1723f","1490481651871-ab68de25d43d"],
    denimjk: ["1495105787522-5334e3ffa0ef","1512436991641-6745cdb1723f","1520006403909-838d6b92c22e"],
    shirt:   ["1596755094514-f87e34085b2c","1523381210434-271e8be1f52b","1490481651871-ab68de25d43d"],
    trouser: ["1517445312882-bc9910d016b7","1556905055-8f358a7a47b2","1520006403909-838d6b92c22e"],
    denim:   ["1556905055-8f358a7a47b2","1495105787522-5334e3ffa0ef","1517445312882-bc9910d016b7"],
    shorts:  ["1517445312882-bc9910d016b7","1556905055-8f358a7a47b2"],  // no shorts in the free pool: trousers stand in, and the alt says so
    vest:    ["1591047139829-d91aecb6caea","1512436991641-6745cdb1723f"],
    indigo:  ["1520006403909-838d6b92c22e","1445205170230-053b83016050"]
  };
  // What the prototype photograph actually shows, for the alt text.
  var IMG_NOUN = {
    sweat: "Sweatshirt", knit: "Wool sweater", fleece: "Fleece pullover", jacket: "Jacket",
    field: "Field jacket", denimjk: "Denim jacket", shirt: "Shirt", trouser: "Trousers",
    denim: "Jeans", shorts: "Trousers", vest: "Vest", indigo: "Cotton garment"
  };
  // Kept for the admin console, which offers these when a record has no picture.
  var GARMENTS = ["1620799140408-edc6dcb6d633","1591047139829-d91aecb6caea","1495105787522-5334e3ffa0ef","1596755094514-f87e34085b2c","1544022613-e87ca75a784a","1517445312882-bc9910d016b7","1434389677669-e08b4cac3105","1512436991641-6745cdb1723f"];
  var DETAILS = ["1490114538077-0a7f8cb49891","1467043237213-65f2da53396f","1523381210434-271e8be1f52b","1556905055-8f358a7a47b2","1479064555552-3ef4979f8908"];
  var LIFESTYLE = ["1441984904996-e0b6ba687e04","1567401893414-76b7b1e5a7a5","1519710164239-da123dc03ef4","1445205170230-053b83016050","1520006403909-838d6b92c22e","1490481651871-ab68de25d43d"];
  // Journal and news pictures, chosen per entry rather than by index arithmetic.
  var JOURNAL_IMG = ["1434389677669-e08b4cac3105","1512436991641-6745cdb1723f","1596755094514-f87e34085b2c","1490481651871-ab68de25d43d","1620799140408-edc6dcb6d633","1441984904996-e0b6ba687e04","1520006403909-838d6b92c22e","1556905055-8f358a7a47b2","1445205170230-053b83016050","1567401893414-76b7b1e5a7a5"];

  var RAW = [
    ["Reverse Weave Crewneck","Champion",1985,19500,"Sweatshirts","Crewneck","M","Grey","Cotton Blend","Very Good","Even fade across the body, with the ribbing still springy at the cuffs and hem. The flock lettering has cracked but is not lifting.","The tag and the reverse-weave construction place this in the mid-1980s, made in the USA. The side gussets and the crossgrain body that limits vertical shrinkage are both present.","USA","sweat","None found.","None.","None.","Even, across the whole body.","None."],
    ["Reverse Weave Hooded Sweatshirt","Champion",1992,27000,"Sweatshirts","Hooded","L","Ecru","Cotton Blend","Very Good","The ecru has warmed unevenly at the shoulders. The hood stands on its own and the drawcord is the original flat cord.","Made in the USA, before production moved. The single-line hem stitching and the dense early ribbing are consistent with the early 1990s.","USA","sweat","None found.","None.","None.","Slightly uneven at the shoulders.","None."],
    ["Synchilla Snap-T Pullover","Patagonia",1994,26000,"Knitwear","Fleece","M","Oatmeal","Fleece","Excellent","Pile is flattened across the chest and slightly greyed at the collar. All four snaps work and hold.","Made in the USA, from the years before Synchilla production moved offshore. The label alone will not date it more closely than the mid-1990s.","USA","fleece","None found.","None.","None.","Minimal.","None."],
    ["Retro-X Deep Pile Fleece","Patagonia",1992,28000,"Outerwear","Fleece Jacket","L","Ecru","Fleece","Very Good","The deep pile has faded to a dry-grass tone at the sleeves, while the shell panels at the shoulder are unworn. It sheds nothing after a wash.","Made in the USA. Beyond the label and the shell-and-pile construction, there is nothing left on the garment that would date it precisely.","USA","jacket","None found.","None.","None.","Strongest at both sleeves.","None."],
    ["Baggies Shorts","Patagonia",1998,9800,"Trousers","Shorts","M","Olive","Nylon","Very Good","Quick-dry nylon, soft and quiet now. The webbing belt has faded a shade lighter than the body.","Late-1990s label. The mesh liner is intact and both hems are original.","USA","shorts","Faint mark inside the waistband; it did not lift.","None.","None.","Belt lighter than the body.","None."],
    ["Maine Warden's Parka","L.L.Bean",1989,48000,"Outerwear","Parka","L","Olive","Cotton","Excellent","Heavy cotton shell over a wool-lined body; the hood keeps its shape without wire. Storm cuffs are intact and still elastic.","Union label from Freeport, Maine. The zip pull is stamped and original.","USA","field","None found.","None.","None.","Minimal.","None."],
    ["Waxed Field Coat","L.L.Bean",1985,42000,"Outerwear","Field Coat","M","Brown","Waxed Cotton","Very Good","The wax has darkened along the seams. Cuffs are worn pale at the edge; the corduroy collar has no bald patches.","We rewaxed it once, by hand, before photographing. The brass zip runs cleanly and no repairs were needed.","USA","field","None found.","None.","Rewaxed by hand in our workroom.","Cuff edges paler than the body.","None."],
    ["Norwegian Wool Sweater","L.L.Bean",1983,23000,"Knitwear","Sweater","M","Navy","Wool","Very Good","Dense wool, felted a little at the underarms. The shoulders are still square and the pattern has not pulled out of line.","Made in Norway for L.L.Bean. The fibre content is on the label; the year is our estimate from the tag style.","Norway","knit","None found.","None.","None.","Minimal.","None."],
    ["Oxford Button-Down Shirt","Ralph Lauren",1991,14000,"Shirting","Oxford","M","Blue","Cotton","Excellent","Oxford cloth washed thin and soft; the collar rolls without a stand. One faint spot beside the second placket button.","Single-needle placket and an unlined collar. We cannot say where it was sewn — the country tag has been cut out.","USA","shirt","Faint spot beside the second placket button; it did not lift.","None.","None.","Minimal.","None."],
    ["Twill Chino Trouser","Ralph Lauren",1996,12000,"Trousers","Chino","L","Ecru","Cotton","Very Good","Broken-in twill with a crease set into the front of the leg. Cuffed once by a previous owner and left that way.","Hong Kong label. The left pocket bag was repaired in matching thread, neatly, by someone before us.","Hong Kong","trouser","None found.","None.","Left pocket bag repaired by a previous owner, in matching thread.","Even at both knees.","None."],
    ["Country Down Vest","Ralph Lauren",1988,31000,"Outerwear","Vest","M","Olive","Down","Excellent","The baffles are sound and the down lofts overnight after a wash. The leather zip pull has darkened where it was held.","Polo Country label. Down content is printed at the hem; the fill weight is not stated.","USA","vest","None found.","None.","None.","Minimal.","None."],
    ["501 Redline Selvedge","Levi's",1983,58000,"Trousers","Denim","M","Indigo","Denim","Very Good","Fade concentrated at the thigh and behind the knee; the knees are soft but not thin. One back pocket has been rebuilt.","Single-stitch, a red selvedge line at the outseam, no hidden rivets. The tab and patch place it in the early 1980s.","USA","denim","None found.","None.","Right back pocket rebuilt with a period-matched denim patch.","Thigh and back of knee.","None."],
    ["517 Bootcut Jean","Levi's",1994,16000,"Trousers","Denim","L","Indigo","Denim","Very Good","A light whisker fade at the front of the hip. Original hem, with the wear a heel leaves.","Made in the USA, orange tab. The right back pocket shows the outline of a wallet.","USA","denim","None found.","Hem edge frayed at the right heel.","None.","Light at the hip.","None."],
    ["Type III Trucker Jacket","Levi's",1990,21000,"Outerwear","Denim Jacket","M","Indigo","Denim","Excellent","Indigo is even and dark, with almost no wear at the cuffs or elbows. The side tabs still adjust.","Made in the USA. It has been washed only a few times, so there is little on the garment to read beyond the label.","USA","denimjk","None found.","None.","None.","None to speak of.","None."],
    ["Detroit Duck Jacket","Carhartt",1997,32000,"Outerwear","Work Jacket","XL","Tan","Duck Canvas","Very Good","Duck canvas bleached across the shoulders and stiff through the back, soft at the elbows and cuffs. The blanket lining is complete.","Union-made label. One front snap was replaced in our workroom; the rest are original.","USA","jacket","None found.","None.","Front snap replaced, cuff edges rewaxed.","Bleached across both shoulders.","None."],
    ["Double Knee Duck Pant","Carhartt",1999,13500,"Trousers","Work Pant","L","Tan","Duck Canvas","Good","Both knees were reinforced by a previous owner in navy thread. The canvas has thinned around the right hip pocket.","Made in Mexico. We left the earlier repairs exactly as they were.","Mexico","trouser","Paint marks at the left thigh.","Canvas thinned at the right hip pocket; no hole yet.","Both knees reinforced in navy thread by a previous owner.","Even overall.","None."],
    ["Blanket-Lined Chore Coat","Carhartt",1993,25000,"Outerwear","Chore Coat","L","Brown","Duck Canvas","Very Good","Stiff at the shoulders and soft where a body has been. Two small mends in the hem lining, sewn in a thread close to the plaid.","Made in the USA. The main seams are triple-stitched; the corduroy collar has flattened on one side.","USA","jacket","None found.","None.","Two small mends in the hem lining, by a previous owner.","Minimal.","None."],
    ["M-47 Cotton Twill Trouser","French Army",1978,24000,"Trousers","Military","M","Olive","Cotton Twill","Very Good","Wide through the thigh with a cinch back. The stencilled size marks are still legible inside the waistband.","French issue. The stamp inside gives a size and a depot mark but no year, so 1978 is our estimate.","France","trouser","None found.","None.","None.","Even, slightly stronger at the seat.","None."],
    ["M-65 Field Jacket","US Army",1981,34000,"Outerwear","Military","M","Olive","Cotton Sateen","Very Good","The sateen has faded unevenly, more on the left sleeve. All four pockets and the collar zip are sound, and the hood is present.","The contract label is intact and readable, which is how the year is known. The liner is not included.","USA","field","None found.","None.","None.","Uneven; strongest on the left sleeve.","Liner not included."],
    ["M59 Field Shirt","Swedish Army",1975,15000,"Shirting","Military","L","Olive","Cotton","Very Good","Thin cotton, nearly translucent at the elbows. It creases sharply and rolls up small.","Swedish issue, with a crown stamp inside. Two buttons have been replaced with period spares.","Sweden","shirt","None found.","Cloth thin at both elbows.","Two buttons replaced with period spares.","Even.","None."],
    ["Bundeswehr Moleskin Trouser","German Army",1988,11000,"Trousers","Military","M","Grey","Moleskin","Excellent","Moleskin brushed soft, closer to suede than to cotton. The factory press is still in the seams.","Bundeswehr issue with a stamped size chart inside. Washed a few times; as far as we can tell it was never worked in.","Germany","trouser","None found.","None.","None.","None to speak of.","None."],
    ["Moleskin Work Jacket","French Workwear",1970,29000,"Outerwear","Work Jacket","M","Ecru","Moleskin","Very Good","Bleached unevenly from black to a pale stone colour, with the original black still visible under the collar. Three patch pockets, no lining.","The maker's label has washed out completely, so we can say only that it is French workwear of the kind made through the 1960s and 70s.","France","jacket","None found.","Small pinhole at the lower back panel.","None.","Heavy, uneven, over the whole garment.","None."],
    ["Cotton Twill Work Jacket","Le Laboureur",1995,18000,"Outerwear","Work Jacket","L","Navy","Cotton Twill","Excellent","French blue twill with no wear at the cuffs. Heavy metal buttons and generous armholes.","Made in Digoin, France, according to the label. Nothing on it has been repaired or replaced.","France","jacket","None found.","None.","None.","None to speak of.","None."],
    ["Railway Denim Jacket","British Workwear",1980,26500,"Outerwear","Denim Jacket","M","Indigo","Denim","Very Good","The indigo has gone grey-blue overall. A company stencil is faint but readable on the left chest.","Issued to railway staff; the stencil carries the company initials. No date is printed anywhere on the garment.","UK","denimjk","Oil spot at the right cuff.","None.","Left cuff restitched in our workroom.","Even, grey-blue overall.","None."],
    ["Windrunner Jacket","Nike",1993,22000,"Outerwear","Shell","L","Ecru","Nylon","Very Good","The nylon has gone soft and quiet. The chevron is crisp and the cuff elastic still returns.","Made in Korea, according to the label. Cream and rust colourway, lining complete.","Korea","jacket","None found.","None.","None.","Minimal.","None."],
    ["ACG Fleece Pullover","Nike",1998,19000,"Knitwear","Fleece","M","Grey","Fleece","Very Good","Heavyweight fleece with the pile flattened at the forearms. The printed ACG logo has cracked across the middle.","Made in Taiwan. The half-zip runs smoothly and the chest pocket lining is intact.","Taiwan","fleece","None found.","None.","None.","Minimal.","None."],
    ["Goose Down Vest","Eddie Bauer",1999,21000,"Outerwear","Vest","L","Navy","Down","Very Good","The baffles hold and the fill lofts after a wash. Snap front complete; one hand pocket has a loose stitch at the opening.","Down content is stated on the hem label. The country of manufacture is not printed.","China","vest","None found.","Loose stitching at one hand-pocket opening.","None.","Minimal.","None."],
    ["Skyliner Down Jacket","Eddie Bauer",1987,37000,"Outerwear","Down Jacket","M","Tan","Down","Excellent","Light for the warmth it gives. The shell has gone slightly matte and the collar snaps are all present.","Made in Seattle, according to the label. No repairs, and the down has not migrated.","USA","jacket","None found.","None.","None.","Minimal.","None."],
    ["Heavy Cotton Chore Coat","GAP",1996,17500,"Outerwear","Chore Coat","L","Navy","Cotton","Very Good","Boxy through the body with a deep armhole. Heavy cotton, faded half a tone at the front placket.","A mid-1990s Gap label. An ordinary garment, in ordinary good condition.","USA","jacket","None found.","None.","None.","Half a tone at the front placket.","None."],
    ["Sashiko Stitched Haori","Japanese Vintage",1970,45000,"Outerwear","Haori","M","Indigo","Cotton","Good","Hand-stitched sashiko repairs cover most of the back panel. The indigo is uneven and the cloth is thin at both shoulders.","Mended by hand over a long period with indigo thread. We could not establish when or where it was made; the cloth is hand-woven.","Japan","indigo","None found.","Cloth thin at both shoulders.","Extensive hand sashiko repair across the back panel, by earlier owners.","Uneven across the whole garment.","None."],
  ];

  var STATUS_PLAN = ["published","published","published","published","published","published","published","published","published","published","published","published","soldout","published","published","draft","published","published","published","soldout","draft","published","published","published","published","published","archived","published","draft","published"];
  var STOCK_PLAN = [1,1,2,1,3,1,1,1,2,1,1,1,0,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1,1];
  var FEATURED = [0,5,11,14,29,18];

  // Prototype imagery: stable assets reused across records, but each slot carries a
  // coherent role so alt text and the gallery describe what is being shown.
  var IMAGE_ROLES = ["front", "back", "fit", "brand label", "care label", "fabric detail", "damage", "repair"];
  var IMAGE_ROLE_PLAN = ["front", "fabric detail", "fit"];
  // Short, factual styling line per category — no advice the pictures contradict.
  var STYLE_NOTE = {
    "Sweatshirts": "Sits on the hip. Worn over a shirt, the collar keeps its line.",
    "Knitwear": "Room for a shirt underneath without pulling at the shoulder.",
    "Outerwear": "Cut to go over a knit; the sleeve keeps its room when layered.",
    "Trousers": "Straight from the hip. The hem falls without breaking on the shoe.",
    "Shirting": "Wears open over a tee, or buttoned with the sleeves left long."
  };

  var SEED_REV = 9;
  var SKU_PREFIX = { "Outerwear": "OW", "Trousers": "TR", "Knitwear": "KN", "Shirting": "SH", "Sweatshirts": "SW" };
  var TROUSER_CATS = ["Trousers"];

  var slugify = function (s) {
    return String(s || "").toLowerCase().trim().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  };
  var pad = function (n, w) { var s = String(n); while (s.length < w) s = "0" + s; return s; };
  var daysAgo = function (n) { var d = new Date(2026, 6, 29); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  var iso = function (n) { var d = new Date(2026, 6, 29, 9, 20); d.setDate(d.getDate() - n); return d.toISOString(); };

  function seedProducts() {
    return RAW.map(function (r, i) {
      var name = r[0], brand = r[1], year = r[2], price = r[3], category = r[4], subcategory = r[5],
        size = r[6], colour = r[7], material = r[8], condition = r[9], curatorNote = r[10], story = r[11], country = r[12];
      var trouser = TROUSER_CATS.indexOf(category) >= 0;
      var imgs = (IMG[r[13]] || IMG.jacket).slice(0);
      return {
        id: i + 1,
        sku: "TSU-" + (SKU_PREFIX[category] || "GN") + "-" + pad(i + 1, 3),
        name: name, brand: brand, year: year, price: price, taxStatus: "Tax included",
        category: category, subcategory: subcategory, size: size, sizeNotation: size + " (vintage)",
        colour: colour, material: material, country: country,
        era: year < 1980 ? "1970s" : year < 1990 ? "1980s" : year < 2000 ? "1990s" : "2000s",
        condition: condition,
        conditionNote: curatorNote,
        stains: r[14], damage: r[15], repairs: r[16], fading: r[17], missingParts: r[18],
        curatorNote: curatorNote, story: story,
        styling: STYLE_NOTE[category] || STYLE_NOTE.Outerwear,
        seedRev: SEED_REV,
        stock: STOCK_PLAN[i], status: STATUS_PLAN[i],
        featured: FEATURED.indexOf(i) >= 0,
        collection: FEATURED.indexOf(i) >= 0 ? "Autumn Archive" : "",
        measurements: trouser
          ? { waist: 38 + (i % 6), rise: 28 + (i % 4), inseam: 74 + (i % 8), hem: 20 + (i % 3) }
          : { shoulder: 44 + (i % 7), chest: 54 + (i % 9), length: 66 + (i % 8), sleeve: 59 + (i % 6) },
        images: imgs.map(function (id, n) {
          var role = IMAGE_ROLE_PLAN[n] || "fabric detail";
          return {
            id: "img-" + (i + 1) + "-" + n, url: U(id, 900), thumb: U(id, 220),
            role: role,
            alt: (IMG_NOUN[r[13]] || "Garment") + ", " + (role === "fit" ? "worn" : role),
            primary: n === 0
          };
        }),
        slug: slugify(brand + " " + name),
        metaTitle: name + " — " + brand + " | TSUMUGI",
        metaDescription: curatorNote.slice(0, 150),
        publishDate: daysAgo((i * 3) % 70),
        createdAt: iso(80 - i),
        updatedAt: iso((i * 2) % 40),
      };
    });
  }

  var FIRST = ["Yuki","Haruto","Mei","Sora","Kenji","Aoi","Ren","Nanami","Takumi","Rio","Ayaka","Daichi","Emi","Shun","Kaori","Elias","Margot","Tomas","Ingrid","Noah","Clara","Hugo","Sofia","Jonas","Amelie"];
  var LAST = ["Tanaka","Sato","Nakamura","Kobayashi","Yoshida","Ishikawa","Matsumoto","Fujita","Ogawa","Hasegawa","Morita","Kikuchi","Uchida","Sakamoto","Nishimura","Vogt","Lindqvist","Marchetti","Halvorsen","Beckmann","Duval","Ferreira","Almeida","Wexler","Rousseau"];
  var CITIES = ["Tokyo","Kyoto","Osaka","Sapporo","Fukuoka","Nagoya","Kanazawa","Sendai","Berlin","Stockholm","Copenhagen","Paris","Lisbon","Milan","Amsterdam"];
  var TAG_POOL = ["Repeat customer","Outerwear buyer","Military collector","Newsletter subscriber","High-value customer"];
  var CSTATUS = ["Active","Active","Active","VIP","Active","Inactive","Active","VIP","Active","Active","Blocked","Active","Active","Inactive","VIP","Active","Active","Active","Inactive","Active","VIP","Active","Active","Active","Active"];

  function seedCustomers(products) {
    var out = [];
    for (var i = 0; i < 25; i++) {
      var first = FIRST[i], last = LAST[i];
      var name = first + " " + last;
      var status = CSTATUS[i];
      // Legacy single "status" is decomposed into three independent axes.
      var accountStatus = status === "Blocked" ? "Suspended" : "Active";
      var segment = status === "VIP" ? "VIP" : "Standard";
      var engagement = status === "Inactive" ? "Dormant" : "Active";
      var orders = status === "VIP" ? 5 + (i % 4) : status === "Inactive" ? 1 : 1 + (i % 4);
      var tags = [];
      if (orders >= 3) tags.push("Repeat customer");
      if (i % 3 === 0) tags.push("Outerwear buyer");
      if (i % 5 === 1) tags.push("Military collector");
      if (i % 2 === 0) tags.push("Newsletter subscriber");
      if (status === "VIP") tags.push("High-value customer");
      var purchases = [];
      var total = 0;
      for (var o = 0; o < orders; o++) {
        var p1 = products[(i * 3 + o * 7) % products.length];
        var p2 = products[(i * 5 + o * 11) % products.length];
        var items = (o % 3 === 0) ? [p1, p2] : [p1];
        var amount = items.reduce(function (t, p) { return t + p.price; }, 0);
        total += amount;
        purchases.push({
          order: "TSU-" + (2026 - (o > 2 ? 1 : 0)) + "-" + pad(1400 + i * 7 + o, 4),
          date: daysAgo(12 + o * 46 + (i % 9)),
          items: items.map(function (p) { return { id: p.id, name: p.name, brand: p.brand, price: p.price, thumb: p.images[0].thumb }; }),
          amount: amount,
          payment: o === 0 && i % 8 === 3 ? "Pending" : i % 11 === 5 && o === 0 ? "Refunded" : "Paid",
          delivery: o === 0 ? (i % 4 === 0 ? "Preparing" : i % 4 === 1 ? "In transit" : "Delivered") : "Delivered",
          card: "•••• " + pad(1000 + ((i * 37 + o * 13) % 9000), 4),
        });
      }
      purchases.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      var registered = daysAgo(20 + i * 26);
      if (i < 4) registered = daysAgo(3 + i * 5);
      out.push({
        id: "CUS-" + pad(1041 + i, 4),
        name: name,
        kana: "",
        email: first.toLowerCase() + "." + last.toLowerCase() + "@example.com",
        phone: "+81 " + (70 + (i % 3)) + "-" + pad(1000 + (i * 137) % 9000, 4) + "-" + pad(2000 + (i * 311) % 7000, 4),
        address: pad(1 + (i % 9), 1) + "-" + (2 + (i % 20)) + "-" + (3 + (i % 15)) + ", " + CITIES[i % CITIES.length] + (i < 8 ? " 150-000" + (i % 9) : ""),
        country: i < 8 ? "Japan" : i % 15 < 8 ? "Japan" : "EU",
        registered: registered,
        orders: purchases.length,
        purchases: purchases,
        totalSpent: total,
        lastPurchase: purchases.length ? purchases[0].date : "",
        status: status,
        accountStatus: accountStatus,
        segment: segment,
        engagement: engagement,
        tags: tags,
        marketing: i % 4 !== 2,
        notes: i % 5 === 0 ? [{ id: "n" + i, author: "R. Seo", at: iso(9 + i), text: "Would like to be told when a size L Warden's Parka comes in. Prefers email to the telephone." }] : [],
        activity: [
          { at: iso(1 + (i % 12)), type: "Profile", text: "Shipping address updated" },
          { at: iso(6 + (i % 20)), type: "Newsletter", text: (i % 4 !== 2 ? "Opted in to" : "Opted out of") + " marketing email" },
          { at: iso(14 + (i % 30)), type: "Purchase", text: "Order " + (purchases.length ? purchases[0].order : "—") + " placed" },
          { at: iso(40 + i * 6), type: "Account", text: "Customer account created" },
        ],
      });
    }
    return out;
  }

  var NEWS = [
    { type: "journal", title: "How much of a repair we leave showing",
      summary: "Why we do not hide a sashiko repair, and what we decide before any thread goes in.",
      category: "Craft", status: "published", age: 2, featured: true, author: "R. Seo",
      alt: "Cream knitwear on a hanger",
      body: "<p>Mending is not restoration. Once a garment has a hole in it, the choice is not between damaged and new — it is between one kind of visible history and another.</p><h3>What we decide first</h3><p>Before any thread goes in, we decide whether the repair is structural or cosmetic. A thinning elbow that will tear within a season gets a backing cloth and a run of sashiko stitching. A small pinhole that has been stable for thirty years usually gets nothing at all.</p><p>Where we do stitch, we use indigo or ecru cotton, close to the cloth but not hidden in it. You should be able to find the repair with your eye, because you will find it with your hand anyway.</p><p>The listing says which repairs are ours and which came with the garment. We leave an earlier owner's work in place when it is sound. Quite often it is better than ours.</p>" },
    { type: "journal", title: "A week in Hokkaido, looking for wool",
      summary: "Five towns, what we looked at, and what we decided not to buy.",
      category: "Sourcing", status: "published", age: 18, featured: false, author: "R. Seo",
      alt: "Rail of wool coats in a shop",
      body: "<p>Seven days, five towns, and one shop that had not been opened for two years. We came back with fourteen garments, which is fewer than the trip cost us.</p><p>Most of the week was spent not buying. A wool coat with a beautiful shoulder had been stored damp and smelled of it in a way that will not wash out. Two Norwegian sweaters had been mended with acrylic yarn, which we can undo, but not for what the seller wanted for them.</p><h3>What we did take</h3><p>Four sweaters from a closing outfitter, still carrying their paper size tags. A grey blanket coat with a broken pocket we can rebuild. And, from a man clearing his father's house, three field jackets he wanted explained to him before he would let them go.</p><p>They will appear here over the next month, once each has been washed, measured and photographed.</p>" },
    { type: "journal", title: "What a label tells you, and what it does not",
      summary: "Union tags, care symbols and country marks — how far they narrow a date, and where they stop.",
      category: "Guides", status: "published", age: 37, featured: false, author: "TSUMUGI Studio",
      alt: "Chambray shirt on a wooden hanger",
      body: "<p>A label is the fastest way into a garment's history and the easiest way to be wrong about it.</p><h3>Three things worth reading</h3><ul><li>Union labels: the design changed several times, so the tag itself brackets a period.</li><li>Care symbols: the standardised set arrived at different dates in different countries, which sometimes rules a decade out.</li><li>Country of manufacture: useful mainly as a pair with the brand — a maker moved production in a known year, and the label follows.</li></ul><p>What a label will not tell you is the year. Stock sat in warehouses, and old labels were used up long after they were designed. A tag gives you a window, usually of five to ten years.</p><p>So we write what the label supports and nothing further. When the window is wide, the listing says so; when the tag is gone or unreadable, we write that the date is unknown. That is not a fault in the garment.</p>" },
    { type: "journal", title: "Photographing a garment in the colour it actually is",
      summary: "Why we shoot by the window, and the rules we keep while doing it.",
      category: "Studio", status: "published", age: 56, featured: false, author: "R. Seo",
      alt: "Pale garments on a rail in daylight",
      body: "<p>Every photograph here is taken by the north window on the second floor, between about ten in the morning and two in the afternoon. There is no flash and no continuous light.</p><p>Studio light sells clothes. It fills the weave, lifts faded cotton back towards a colour it no longer has, and flattens the shadow that tells you how heavy a cloth is. Window light is less flattering and more useful.</p><h3>The rules we keep</h3><ul><li>One light source, and no reflector on the front.</li><li>White balance set from a grey card once per session, never per photograph.</li><li>No dodging, no added saturation, no removing marks — a stain that is in the garment is in the picture.</li></ul><p>On a grey day we wait. It costs a day of listing, and it is the reason a parcel arrives looking like its photographs.</p>" },
    { type: "journal", title: "Washing a forty-year-old sweater",
      summary: "Cold water, flat drying, and the decision not to wash at all.",
      category: "Guides", status: "published", age: 74, featured: false, author: "TSUMUGI Studio",
      alt: "Cream sweatshirt laid flat",
      body: "<p>The damage we see most often is not moths. It is hot water, strong detergent and haste.</p><h3>What we do here</h3><p>Cold water, a neutral wool detergent, and thirty minutes of soaking rather than agitation. Lift the sweater out supporting the whole body — wet wool stretches under its own weight if you hold it by the shoulders. Press the water out in a towel; never wring it.</p><p>Dry flat, out of direct sun, and reshape it while it is still damp. Measure the chest and the sleeve before washing, then pull it gently back to those numbers.</p><p>Often the right answer is not to wash at all. A night in moving air clears most of what makes a garment smell old. We wash a piece once before it goes on the rail; after that we would rather you left it alone until it needs it.</p>" },
    { type: "news", title: "August opening hours",
      summary: "Our opening days change through Obon week. Online orders ship as usual.",
      category: "Announcements", status: "published", age: 6, featured: false, author: "TSUMUGI Studio",
      alt: "Interior of the shop with a clothing rail",
      body: "<p>Through Obon week the shop is open Friday to Sunday only, 12:00 to 19:00. We are closed on Thursday 13 and Thursday 20 August.</p><p>Online orders are dispatched as usual, within two business days. Email replies may take a day longer than normal that week.</p><p>The wooden stair on the east side of the building is being repainted on 14 and 15 August. It stays open, but the paint will be wet — please use the handrail on the left.</p>" },
    { type: "news", title: "Autumn arrivals from 12 September",
      summary: "Sixty pieces, mostly outerwear, published from 11:00 on 12 September.",
      category: "Releases", status: "scheduled", age: -12, featured: true, author: "TSUMUGI Studio",
      alt: "Rail of garments in the shop",
      body: "<p>Sixty pieces will be published from 11:00 on 12 September, in three groups through the day: outerwear first, then trousers, then knitwear and shirting.</p><p>Most of it came from two sourcing trips in June and July — field jackets, three waxed coats, and a run of Norwegian sweaters from a closing outfitter in Hokkaido.</p><p>Everything is one of one. Each piece is washed, measured and photographed before it appears, so listings go up as they are finished rather than all at once.</p><p>The shop is open the same day, Thursday to Sunday, 12:00—19:00, and anything published online can be seen on the rail.</p>" },
    { type: "news", title: "Repair consultations — first Saturday of the month",
      summary: "Bring one garment. We will look at it with you and say what can be mended.",
      category: "Events", status: "published", age: 26, featured: false, author: "R. Seo",
      alt: "Sweatshirt and jeans laid out flat",
      body: "<p>On the first Saturday of each month, from 13:00 to 17:00, bring one garment and we will look at it with you.</p><p>We will tell you what we would do, what we would leave alone, and roughly what it would cost. Small work — a seam, a button, a single hole — is usually done on the spot at no charge. Anything larger we quote, and you are free to take it elsewhere.</p><p>It does not have to be something you bought from us. No appointment is needed; if two people are already waiting, we may ask you to come back later in the afternoon.</p>" },
    { type: "journal", title: "An unworn garment tells us the least",
      summary: "Why deadstock leaves us with the least to describe.",
      category: "Essays", status: "draft", age: 1, featured: false, author: "R. Seo",
      alt: "Shop window with garments",
      body: "<p>Deadstock is easy to sell and hard to describe. Nothing has happened to it yet, so there is nothing to report beyond the label and the measurements.</p><p>A worn garment tells you where its owner's hands went, which seam gave first, whether the cloth thinned before the stitching did. That is the information we can pass on: not that a piece is rare, but that it has already proved it lasts.</p><h3>Where we do keep it</h3><p>We take unworn pieces occasionally, when the cut or the cloth is worth seeing intact — a reference for what the same garment looks like before thirty years of use. The listing says plainly that it has not been worn.</p><p>But we would rather sell you the one with the mended pocket. It has answered a question the other one has not been asked yet.</p>" },
    { type: "news", title: "We are looking for help with measuring and photography",
      summary: "Two days a week at the Kirigaya shop: measuring, photography and record-keeping.",
      category: "Announcements", status: "archived", age: 120, featured: false, author: "TSUMUGI Studio",
      alt: "Wardrobe of hanging clothes",
      body: "<p>Two days a week at the Kirigaya shop, Thursday and Friday, 11:00 to 18:00. The work is measuring, photographing and writing up new arrivals, alongside one of us.</p><p>No experience with vintage clothing is required. It helps if you are patient with a tape measure and comfortable writing plainly about condition.</p><p>Send a short email to hello@tsumugi.archive telling us what you wear most, and why. We reply to everyone.</p><p><em>This position has since been filled. Thank you to everyone who wrote.</em></p>" },
  ];

  function seedNews(products) {
    return NEWS.map(function (n, i) {
      return {
        id: i + 1,
        type: n.type,
        title: n.title,
        slug: slugify(n.title),
        summary: n.summary,
        image: U(JOURNAL_IMG[i], 1200),
        thumb: U(JOURNAL_IMG[i], 220),
        alt: n.alt,
        body: n.body,
        author: n.author,
        category: n.category,
        tags: n.type === "journal" ? ["archive", "craft"] : ["shop", "notice"],
        relatedProducts: [products[(i * 4) % products.length].id, products[(i * 4 + 5) % products.length].id],
        seoTitle: n.title + " | TSUMUGI",
        seoDescription: n.summary.slice(0, 150),
        status: n.status,
        publishDate: daysAgo(n.age),
        updatedAt: iso(Math.max(0, n.age - 1)),
        featured: n.featured,
        seedRev: SEED_REV,
      };
    });
  }

  /* ---- arrivals journals ----
     An "arrivals" entry exists because someone wrote and published it, not
     because the month turned: the records below are edited content like any
     other journal entry, and the home hero simply reads the two most recently
     published ones. Category "Arrivals" is what marks them. */
  var ARRIVALS = [
    {
      title: "August Arrivals", publishDate: "2026-08-06",
      img: "1512436991641-6745cdb1723f", alt: "Rail of vintage coats in warm daylight",
      rel: [2, 9, 17],
      summary: "Twenty-two pieces, most of them out of one house in Nagano, and two we sent back.",
      body: "<p>Twenty-two pieces this month. Most came from a single house in Nagano, cleared by a family who had kept everything: work coats, three generations of shirting, and a wardrobe of wool that had never been near a moth.</p>"
        + "<h3>What we kept</h3>"
        + "<p>The four indigo work coats are the reason we drove up. All four had been mended before, by hand, in a way that tells you the same person did it each time. We washed them and left every stitch where it was.</p>"
        + "<p>We also took a run of cotton shirting, ordinary in every respect except that it has been washed a few hundred times and is still square at the shoulder. That is not a thing you can go out and find on purpose.</p>"
        + "<h3>What we sent back</h3>"
        + "<p>Two coats had been stored in a shed, and the smell was in the wadding rather than on the cloth. Nothing we do here would have taken it out, so they went back with the rest of the house.</p>"
        + "<p>The pieces below went up first. The rest are on the rail at Kirigaya as they are finished.</p>"
    },
    {
      title: "July Arrivals", publishDate: "2026-07-04",
      img: "1434389677669-e08b4cac3105", alt: "Cream knitwear on a wooden hanger",
      rel: [5, 12, 20],
      summary: "Fourteen pieces out of the Hokkaido week, and the first of the winter knitwear.",
      body: "<p>Fourteen pieces, all of them from the week we spent in Hokkaido in June. They are the last of that trip — everything else is either sold or still waiting on a repair.</p>"
        + "<h3>The knitwear</h3>"
        + "<p>Four Norwegian sweaters from a closing outfitter, still carrying their paper size tags. They have never been worn, which is unusual for us, and each listing says so plainly: an unworn garment has less to tell you than a used one.</p>"
        + "<p>The grey blanket coat is the piece we would keep. Its pocket was rebuilt here, in cloth taken from inside the hem, and you can find the work if you look for it.</p>"
        + "<h3>On sizing</h3>"
        + "<p>Most of this month runs a size large against present-day labels. Every listing carries measurements taken flat; please read those rather than the tag.</p>"
    },
    {
      title: "June Arrivals", publishDate: "2026-06-05",
      img: "1591047139829-d91aecb6caea", alt: "Faded rust-coloured jacket on a plaster wall",
      rel: [7, 14, 23],
      summary: "A quiet month: nine pieces, and the reason there were not more.",
      body: "<p>Nine pieces. Two buying trips came to nothing, and we would rather list nine garments we can describe honestly than thirty we cannot.</p>"
        + "<p>What did arrive is mostly summer cotton — fatigue trousers, two French work jackets with the maker's mark washed out of them, and a chambray shirt faded almost to white at the yoke.</p>"
        + "<h3>On the repairs</h3>"
        + "<p>Three of the nine reached us already mended, and all three were left as they were. The listings say which repairs came with the garment and which are ours.</p>"
        + "<p>The rest of the month went on photographing what was already here. It does not show from the outside, and it is most of the work.</p>"
    }
  ];

  /* Newest first, as written. Nothing here depends on the calendar. */
  function seedArrivals(products) {
    return ARRIVALS.map(function (a, i) {
      return {
        id: 11 + i,
        type: "journal",
        title: a.title,
        slug: slugify(a.title + " " + a.publishDate.slice(0, 4)),
        summary: a.summary,
        image: U(a.img, 1200),
        thumb: U(a.img, 220),
        alt: a.alt,
        body: a.body,
        author: "R. Seo",
        category: "Arrivals",
        tags: ["arrivals", "archive"],
        relatedProducts: (products && products.length)
          ? a.rel.map(function (k) { return products[k % products.length].id; })
          : [],
        seoTitle: a.title + " | TSUMUGI",
        seoDescription: a.summary.slice(0, 150),
        status: "published",
        publishDate: a.publishDate,
        updatedAt: a.publishDate + "T11:00:00.000Z",
        featured: false,
        seedRev: SEED_REV,
      };
    });
  }

  /* ---- home hero: featured content ----
     An ordered, edited list. A journal feature keeps the article as its single
     source of truth (title, image, alt, slug and both translations are read from
     the record, never copied here); a page feature names an internal route.
     Only the DEFAULT is derived from the newest arrivals — after that nothing
     recomputes it, and the console owns the list. */
  function heroRecord(k, patch) {
    return Object.assign({
      id: "hero-0" + k, order: k, enabled: true,
      sourceType: "journal", sourceId: null, route: "",
      titleOverrideEn: "", titleOverrideJa: "", imageOverride: "",
      altOverrideEn: "", altOverrideJa: ""
    }, patch || {});
  }

  function seedHeroFeatures(news) {
    var live = (news || []).filter(function (n) {
      return n.category === "Arrivals" && n.status === "published";
    }).sort(function (a, b) { return a.publishDate < b.publishDate ? 1 : -1; });
    var out = [], k = 1;
    live.slice(0, 2).forEach(function (n) {
      out.push(heroRecord(k, { sourceType: "journal", sourceId: n.id })); k++;
    });
    ["shop", "about"].forEach(function (r) {
      out.push(heroRecord(k, { sourceType: "page", route: r })); k++;
    });
    return out;
  }

  function heroLabel(f) {
    if (!f) return "—";
    if (f.sourceType === "page") return "“" + (f.route || "unset") + "” (page)";
    var n = (f.sourceId == null || f.sourceId === "") ? null : Store.getNews(f.sourceId);
    return "“" + (n ? n.title : "unset") + "” (journal)";
  }

  function specialLabel(f) {
    if (!f) return "—";
    var name = f.titleEn || f.titleJa || f.slug || f.id;
    return "“" + name + "”";
  }

  /* order is renumbered 1..n on every write, so it is always unique and dense.     Takes the database explicitly: migrate() runs while `var db` is still
     undefined, and reading the module variable from here threw on every load —
     which reseeded the whole store and silently discarded the stored copy. */
  function normaliseHero(target) {
    var d = target || db;
    d.heroFeatures = (d.heroFeatures || []).slice().sort(function (a, b) {
      return (Number(a.order) || 0) - (Number(b.order) || 0);
    });
    d.heroFeatures.forEach(function (f, i) { f.order = i + 1; });
  }

  /* ---- prototype roles: a UX demonstration, not security ---- */
  var PERMS = {
    owner: ["settings.view","orders.view","orders.edit","orders.refund","products.view","products.edit","products.publish","products.delete","customers.view","customers.edit","customers.pii","customers.delete","content.view","content.edit","content.publish","export","settings","roles","reset"],
    manager: ["settings.view","orders.view","orders.edit","orders.refund","products.view","products.edit","products.publish","products.delete","customers.view","customers.edit","customers.pii","content.view","content.edit","content.publish","export","settings"],
    editor: ["products.view","content.view","content.edit","content.publish"],
    support: ["orders.view","orders.edit","customers.view","customers.edit","products.view","content.view"],
    viewer: ["settings.view","orders.view","products.view","customers.view","content.view"],
    /* Anonymous portfolio visitor: reads the console's editorial surfaces and
       changes nothing. Real orders and real customer records are deliberately
       NOT here — an anonymous session is a stranger with a token, and the
       orders/customers screens hold other people's names, addresses and spend.
       (Under Supabase this is the same subject as auth.jwt()->>'is_anonymous' =
       true; see supabase/migrations and AUTH_MIGRATION.md.) */
    guest: ["settings.view", "products.view", "content.view"],
    /* A storefront customer is not a member of staff. The entry exists so the
       role is a known quantity rather than an unmatched string, and it is empty
       on purpose: every can() check in the console answers false for it. */
    customer: [],
    /* Default-deny bucket for any role string that is not one of the above.
       Nothing falls through to an operator role. */
    denied: []
  };
  var ACCOUNTS = [
    { email: "admin@tsumugi.archive", password: "tsumugi-demo", name: "R. Seo", role: "owner" },
    { email: "manager@tsumugi.archive", password: "tsumugi-demo", name: "K. Ito", role: "manager" },
    { email: "editor@tsumugi.archive", password: "tsumugi-demo", name: "S. Nakamura", role: "editor" },
    { email: "support@tsumugi.archive", password: "tsumugi-demo", name: "M. Fujita", role: "support" },
    { email: "viewer@tsumugi.archive", password: "tsumugi-demo", name: "T. Ogawa", role: "viewer" }
  ];

  /* ---- customer accounts (storefront) ----
     The storefront's own auth subject, kept completely apart from the console's
     staff and anonymous-guest sessions. This is the local demo provider's
     backing store; tsumugi-auth.js is the only caller, and Supabase replaces
     all of it. Shapes mirror the intended tables one-for-one:

       authUsers  → auth.users      (id, email, role)
       profiles   → profiles        (id, role, display_name, phone, customer_id)
       addresses  → addresses       (id, user_id, postal_code, prefecture, city, address, is_default)
       wishlists  → wishlists       (user_id, product_id, created_at)

     No password is stored for any account. Accounts created here keep a random
     salt and a SHA-256 digest of salt+password, which is a demonstration, not a
     security boundary — the real boundary is Supabase Auth plus RLS. */
  var ANON_WISH = "anon";      /* the not-signed-in wishlist bucket */
  /* Local demo provider ONLY. Not a secret and not a production credential: it
     exists so a portfolio visitor can open a customer account, it is printed on
     the sign-in screen as a demo, and filling in auth-config.js retires the
     whole local provider along with this account. Nothing is persisted for it. */
  var DEMO_CUSTOMER = { email: "haruto.sato@example.com", password: "demo-customer", customerId: "CUS-1042", uid: "cus-demo-1" };
  var CITY_PREF = { Tokyo: "Tokyo", Kyoto: "Kyoto", Osaka: "Osaka", Sapporo: "Hokkaido", Fukuoka: "Fukuoka", Nagoya: "Aichi", Kanazawa: "Ishikawa", Sendai: "Miyagi" };
  var CITY_POST = { Tokyo: "150-0002", Kyoto: "604-8001", Osaka: "530-0001", Sapporo: "060-0001", Fukuoka: "810-0001", Nagoya: "460-0008", Kanazawa: "920-0852", Sendai: "980-0021" };

  function digest(pw, salt) {
    var text = String(salt) + "|" + String(pw);
    try {
      if (window.crypto && crypto.subtle && crypto.subtle.digest && window.TextEncoder) {
        return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (h) {
          return Array.prototype.map.call(new Uint8Array(h), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
        });
      }
    } catch (e) { }
    /* Insecure context (file://): a demo digest so the prototype still runs. */
    var h2 = 5381;
    for (var i = 0; i < text.length; i++) h2 = ((h2 * 33) ^ text.charCodeAt(i)) >>> 0;
    return Promise.resolve("demo-" + h2.toString(16));
  }

  /* One seeded customer account, linked to one seeded customer record by an
     explicit id — never by matching an email address. */
  function seedAccounts(customers) {
    var c = (customers || []).find(function (x) { return x.id === DEMO_CUSTOMER.customerId; });
    if (!c) return { authUsers: [], profiles: [], addresses: [] };
    c.authUserId = DEMO_CUSTOMER.uid;
    var m = String(c.address || "").match(/^(.*?),\s*([^,\d]+?)(?:\s+(\d{3}-?\d{4}))?$/);
    var line = m ? m[1] : (c.address || "");
    var city = m ? m[2].trim() : "Tokyo";
    /* The seed's address string carries a Tokyo postcode whatever the city, so
       the demo address is given one that belongs to its own prefecture. */
    var post = CITY_POST[city] || (m && m[3]) || "150-0002";
    return {
      authUsers: [{
        id: DEMO_CUSTOMER.uid, email: DEMO_CUSTOMER.email, role: "customer",
        demo: true, salt: "", digest: "", customerId: c.id,
        createdAt: (c.registered || "2026-01-01") + "T09:00:00.000Z"
      }],
      profiles: [{
        id: DEMO_CUSTOMER.uid, role: "customer", displayName: c.name, phone: c.phone,
        customerId: c.id, createdAt: (c.registered || "2026-01-01") + "T09:00:00.000Z"
      }],
      addresses: [{
        id: "adr-" + DEMO_CUSTOMER.uid, userId: DEMO_CUSTOMER.uid,
        postalCode: post, prefecture: CITY_PREF[city] || "Tokyo", city: city,
        address: line, isDefault: true
      }]
    };
  }

  var PAYMENT_STATUSES = ["Pending", "Paid", "Refunded", "Failed"];
  var FULFILMENT_STATUSES = ["Unfulfilled", "Preparing", "Shipped", "Delivered", "Cancelled", "Returned"];
  var DELIVERY_METHODS = ["Standard shipping", "Store pickup"];

  var PREFECTURES = ["Tokyo","Osaka","Kyoto","Hokkaido","Fukuoka","Aichi","Ishikawa","Miyagi","Kanagawa","Hyogo"];

  // Orders are derived from the customers' purchase records so that purchase
  // history and the orders module describe the same events, not two datasets.
  function seedOrders(customers, products) {
    var out = [];
    customers.forEach(function (c, ci) {
      (c.purchases || []).forEach(function (pu, pi) {
        var fulfil = pu.delivery === "Preparing" ? "Preparing"
          : pu.delivery === "In transit" ? "Shipped"
          : pu.delivery === "Delivered" ? "Delivered" : "Unfulfilled";
        if (pu.payment === "Refunded") fulfil = "Returned";
        var method = (ci + pi) % 7 === 3 ? "Store pickup" : "Standard shipping";
        var fee = method === "Store pickup" ? 0 : 0;
        var items = pu.items.map(function (it) {
          return { productId: it.id, name: it.name, brand: it.brand, price: it.price, qty: 1, thumb: it.thumb };
        });
        var sub = items.reduce(function (t, it) { return t + it.price * it.qty; }, 0);
        out.push({
          id: pu.order,
          number: pu.order,
          date: pu.date,
          createdAt: pu.date + "T10:15:00.000Z",
          updatedAt: pu.date + "T10:15:00.000Z",
          customerId: c.id,
          customerName: c.name,
          /* Seeded history predates customer accounts: no auth user, and not a
             guest checkout either — these came in over the counter. */
          userId: null,
          guestEmail: null,
          email: c.email,
          phone: c.phone,
          shipping: {
            name: c.name,
            postalCode: "1" + pad(50000 + ci * 137, 5).slice(0, 5),
            prefecture: PREFECTURES[ci % PREFECTURES.length],
            city: CITIES[ci % CITIES.length],
            address: c.address
          },
          items: items,
          itemCount: items.length,
          subtotal: sub,
          shippingFee: fee,
          total: sub + fee,
          paymentStatus: pu.payment === "Pending" ? "Pending" : pu.payment === "Refunded" ? "Refunded" : "Paid",
          fulfilmentStatus: fulfil,
          deliveryMethod: method,
          paymentMethod: (ci + pi) % 5 === 2 ? "Demo cash on delivery" : "Demo credit card",
          tracking: fulfil === "Shipped" || fulfil === "Delivered" ? "JP" + pad(4200000 + ci * 971 + pi, 9) : "",
          notes: [],
          history: [{ at: pu.date + "T10:15:00.000Z", who: "system", role: "owner", text: "Order placed" }],
          source: "seed"
        });
      });
    });
    return out.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  function seedAudit() {
    return [
      { id: "aud-1", at: iso(0.1), who: "admin@tsumugi.archive", role: "owner", action: "login", entityType: "session", entityId: "-", summary: "Signed in to the admin console" },
      { id: "aud-2", at: iso(0.4), who: "admin@tsumugi.archive", role: "owner", action: "product.publish", entityType: "product", entityId: "2", summary: "Published “Reverse Weave Hooded Sweatshirt”" },
      { id: "aud-3", at: iso(1.2), who: "k.ito@tsumugi.archive", role: "manager", action: "customer.export", entityType: "customer", entityId: "12 records", summary: "Exported 12 customer records — purpose: quarterly VIP review" },
      { id: "aud-4", at: iso(2.1), who: "m.fujita@tsumugi.archive", role: "support", action: "pii.reveal", entityType: "customer", entityId: "CUS-1044", summary: "Revealed contact details for CUS-1044" },
      { id: "aud-5", at: iso(3.4), who: "admin@tsumugi.archive", role: "owner", action: "order.status", entityType: "order", entityId: "TSU-2026-1441", summary: "Order TSU-2026-1441 marked shipped" }
    ];
  }

  function seedActivity() {
    return [
      { at: iso(0), who: "admin@tsumugi.archive", text: "Published “Reverse Weave Hooded Sweatshirt”", kind: "publish" },
      { at: iso(0.2), who: "admin@tsumugi.archive", text: "Marked “517 Bootcut Jean” as sold out", kind: "status" },
      { at: iso(1), who: "k.ito@tsumugi.archive", text: "Created draft “An unworn garment tells us the least”", kind: "create" },
      { at: iso(2), who: "admin@tsumugi.archive", text: "Updated stock for 3 products", kind: "update" },
      { at: iso(3), who: "r.seo@tsumugi.archive", text: "Added tag “Military collector” to 4 customers", kind: "update" },
      { at: iso(4), who: "admin@tsumugi.archive", text: "Scheduled “Autumn arrivals from 12 September”", kind: "schedule" },
    ];
  }

  /* ---- special features (Shop editorial curation) ----
     A different object from heroFeatures: the home hero points at journal
     entries and pages, while a special feature is a curated set of PRODUCTS
     shown in the Shop. Seeded from the products actually present, never from
     hard-coded ids, so a stored database can never hold a dangling reference
     the seed itself introduced.

     Shape mirrors the intended tables (see the Store section further down):
       special_features         one row per feature
       special_feature_products candidateProductIds[], order = sort_order
       special_feature_media    media[], slot + sortOrder */
  function seedSpecialFeatures(products) {
    var byCat = function (cat, n) {
      return (products || []).filter(function (p) { return p.category === cat; })
        .slice(0, n).map(function (p) { return p.id; });
    };
    /* Dates are relative to the real clock, not the seed's fixed epoch: the
       demo must show one active, one scheduled and one archived feature
       whenever it is opened. */
    var at = function (dayOffset, hour) {
      var d = new Date();
      d.setHours(hour == null ? 9 : hour, 0, 0, 0);
      d.setDate(d.getDate() + dayOffset);
      return d.toISOString();
    };
    var rows = [
      {
        id: "sf-light-outerwear", slug: "light-outerwear",
        titleEn: "Light outerwear for early autumn", titleJa: "秋口のライトアウター",
        descriptionEn: "Six pieces picked for the weeks when a jacket is enough. Cotton and light down, nothing lined for winter.",
        descriptionJa: "上着一枚で足りる時期のために選んだ六点。綿と薄手のダウンで、冬向けの裏地付きは入れていません。",
        category: "Outerwear", eraLabel: "1988—1999",
        enabled: true, publishAt: at(-20), unpublishAt: at(15),
        candidateProductIds: byCat("Outerwear", 6),
        media: [{
          id: "sfm-light-1", type: "image", slot: "primary", sourceType: "custom",
          productId: null, imageIndex: null, sortOrder: 1,
          src: U("1523381210434-271e8be1f52b", 1000),
          altEn: "Light jacket on a wooden hanger, photographed in daylight",
          altJa: "木製ハンガーに掛けた薄手のジャケット、自然光で撮影"
        }]
      },
      {
        id: "sf-old-sweats", slug: "old-sweatshirts",
        titleEn: "Old sweatshirts", titleJa: "古いスウェット",
        descriptionEn: "Reverse weave and single stitch, kept for the way the pile has flattened rather than for the label.",
        descriptionJa: "リバースウィーブとシングルステッチ。ラベルよりも、起毛の潰れ方で選んでいます。",
        category: "Sweatshirts", eraLabel: "1990—2005",
        enabled: true, publishAt: at(15), unpublishAt: at(55),
        candidateProductIds: byCat("Sweatshirts", 3).concat(byCat("Knitwear", 3)),
        media: []
      },
      {
        id: "sf-summer-shirts", slug: "summer-shirts",
        titleEn: "Summer shirts", titleJa: "夏のシャツ",
        descriptionEn: "Worn-in cotton, open over a tee. Shown in the shop through July.",
        descriptionJa: "着込まれた綿のシャツを、Tシャツの上に羽織って。7月いっぱいの特集でした。",
        category: "Shirting", eraLabel: "1970—1999",
        enabled: true, publishAt: at(-90), unpublishAt: at(-30),
        candidateProductIds: byCat("Shirting", 5),
        media: []
      }
    ];
    return rows.map(function (r) {
      return Object.assign({ createdAt: at(-100), updatedAt: at(-1) }, r);
    });
  }

  /* Structural clean-up only — a special feature has no manual order. Any
     `priority` an older save carries is removed here rather than honoured, so
     nothing in the app can start depending on it again. Takes the database
     explicitly: migrate() runs before `var db` is assigned, and reading the
     module variable from a normaliser is exactly the bug that once reseeded
     the whole store. */
  function normaliseSpecials(target) {
    var d = target;
    if (!d || !Array.isArray(d.specialFeatures)) return;
    d.specialFeatures.forEach(function (f) {
      if ("priority" in f) delete f.priority;
      if (!Array.isArray(f.candidateProductIds)) f.candidateProductIds = [];
      if (!Array.isArray(f.media)) f.media = [];
      /* v8: a media row is now either a chosen product photograph
         (sourceType "product", productId + imageIndex) or an editorial image
         of its own (sourceType "custom", src). Rows written before that are
         custom images by definition, so they are read as they stand. */
      f.media.forEach(function (m, n) {
        if (m.sortOrder == null) m.sortOrder = n + 1;
        if (!m.sourceType) m.sourceType = (m.productId != null && m.imageIndex != null) ? "product" : "custom";
        if (m.imageIndex == null) m.imageIndex = null;
        if (m.src == null) m.src = "";
      });
    });
  }

  function freshDB() {
    var products = seedProducts();
    var customers = seedCustomers(products);
    var newsList = seedNews(products).concat(seedArrivals(products));
    var acc = seedAccounts(customers);
    return {
      version: 8,
      products: products,
      customers: customers,
      orders: seedOrders(customers, products),
      news: newsList,
      heroFeatures: seedHeroFeatures(newsList),
      specialFeatures: seedSpecialFeatures(products),
      authUsers: acc.authUsers,
      profiles: acc.profiles,
      addresses: acc.addresses,
      wishlists: [],
      activity: seedActivity(),
      audit: seedAudit(),
      settings: {
        storeName: "TSUMUGI",
        tagline: "Vintage Shop",
        email: "hello@tsumugi.archive",
        phone: "+81 3-5843-0000",
        address: "〒151-0074 東京都渋谷区霧ヶ谷4-11-6",
        currency: "JPY",
        lowStockThreshold: 1,
        itemsPerPage: 10,
        notifyDrafts: true,
        notifyLowStock: true,
      },
    };
  }

  /* Upgrades an older save in place. Existing edits are preserved; only genuinely
     absent structures are added. Reseeds solely when the record set is unusable. */
  function migrate(db) {
    var fresh = null;
    var seed = function () { if (!fresh) fresh = freshDB(); return fresh; };

    db.products.forEach(function (p) {
      if (!Array.isArray(p.images)) p.images = [];
      p.images.forEach(function (im, n) {
        if (!im.role) im.role = IMAGE_ROLE_PLAN[n] || "fabric detail";
        // Upgrade only the generic seeded alt text; hand-written alt is preserved.
        if (!im.alt || /,\s*view\s*\d+$/i.test(im.alt)) im.alt = (p.name || "Archive piece") + " — " + im.role;
      });
      if (p.stains == null) p.stains = "None found.";
      if (p.damage == null) p.damage = "None.";
      if (p.repairs == null) p.repairs = "None.";
    });

    db.customers.forEach(function (c) {
      if (!c.accountStatus) c.accountStatus = c.status === "Blocked" ? "Suspended" : "Active";
      if (!c.segment) c.segment = c.status === "VIP" ? "VIP" : "Standard";
      if (!c.engagement) c.engagement = c.status === "Inactive" ? "Dormant" : "Active";
      if (!Array.isArray(c.notes)) c.notes = [];
      if (!Array.isArray(c.activity)) c.activity = [];
      if (!Array.isArray(c.purchases)) c.purchases = [];
    });

    if (!Array.isArray(db.orders) || !db.orders.length) {
      // Derive orders from the purchase records already held on each customer.
      db.orders = seedOrders(db.customers, db.products);
    }
    db.orders.forEach(function (o) {
      if (!o.number) o.number = o.id;
      if (!Array.isArray(o.notes)) o.notes = [];
      if (!Array.isArray(o.history)) o.history = [];
      if (!o.shipping) o.shipping = { name: o.customerName || "", postalCode: "", prefecture: "", city: "", address: "" };
      if (o.itemCount == null) o.itemCount = (o.items || []).length;
      /* Both nullable, exactly as the future orders table: an order belongs to a
         customer account (user_id) or to a guest checkout (guest_email). */
      if (o.userId === undefined) o.userId = null;
      if (o.guestEmail === undefined) o.guestEmail = o.userId ? null : (o.email || null);
    });

    /* Storefront customer accounts. Added to an existing save without touching
       anything already in it; the seeded demo account appears only if the
       customer record it is explicitly linked to is still present. */
    db.customers.forEach(function (c) { if (c.authUserId === undefined) c.authUserId = null; });
    if (!Array.isArray(db.wishlists)) db.wishlists = [];
    if (!Array.isArray(db.authUsers) || !Array.isArray(db.profiles) || !Array.isArray(db.addresses)) {
      var acc = seedAccounts(db.customers);
      db.authUsers = Array.isArray(db.authUsers) ? db.authUsers : acc.authUsers;
      db.profiles = Array.isArray(db.profiles) ? db.profiles : acc.profiles;
      db.addresses = Array.isArray(db.addresses) ? db.addresses : acc.addresses;
    }
    /* The demo account is seed data like any other: when it is pointed at a
       different customer record, an existing save is corrected once. Accounts
       someone created themselves are never touched. */
    (function () {
      var du = (db.authUsers || []).find(function (u) { return u.demo && u.id === DEMO_CUSTOMER.uid; });
      if (!du || du.email === DEMO_CUSTOMER.email) return;
      var old = (db.customers || []).find(function (c) { return c.id === du.customerId; });
      if (old && old.authUserId === du.id) old.authUserId = null;
      var fresh = seedAccounts(db.customers);
      if (!fresh.authUsers.length) return;
      db.authUsers = (db.authUsers || []).filter(function (u) { return u.id !== du.id; }).concat(fresh.authUsers);
      db.profiles = (db.profiles || []).filter(function (p) { return p.id !== du.id; }).concat(fresh.profiles);
      db.addresses = (db.addresses || []).filter(function (a) { return a.userId !== du.id; }).concat(fresh.addresses);
    })();

    if (!Array.isArray(db.audit)) db.audit = seedAudit();
    if (!Array.isArray(db.activity)) db.activity = seedActivity();
    if (!db.news || !Array.isArray(db.news)) db.news = seed().news;
    /* Arrivals used to be generated per calendar month into the 500+ id range.
       Those records are retired here, and the written ones carried in, so a
       stored copy from the earlier build lands on the edited entries. */
    (function () {
      db.news = db.news.filter(function (n) { return !(Number(n.id) >= 500 && n.category === "Arrivals"); });
      var have = {};
      db.news.forEach(function (n) { have[String(n.id)] = true; });
      seedArrivals(db.products).forEach(function (a) { if (!have[String(a.id)]) db.news.unshift(a); });
    })();
    if (!db.settings) db.settings = seed().settings;
    /* Hero configuration is seeded for an existing database only when it is
       absent, so an edited hero is never overwritten. */
    if (!Array.isArray(db.heroFeatures) || !db.heroFeatures.length) {
      db.heroFeatures = seedHeroFeatures(db.news);
    }
    normaliseHero(db);

    /* v7: special features. Purely additive — the key is seeded only when it is
       absent, so an edited set is never overwritten, and a failure here must not
       be allowed to look like an unusable database (which would reseed). */
    try {
      if (!Array.isArray(db.specialFeatures)) db.specialFeatures = seedSpecialFeatures(db.products);
      normaliseSpecials(db);
    } catch (e) {
      if (window.console && console.error) {
        console.error("tsumugi-data.js: special-feature migration failed; existing data left untouched.", e);
      }
      if (!Array.isArray(db.specialFeatures)) db.specialFeatures = [];
    }

    /* v6 brought new seed copy, corrected demo imagery and the canonical shop
       details. Records that shipped with the demo are refreshed once; anything
       the user created, and every field they own (price, stock, status,
       measurements, orders), is left exactly as it was. */
    var behind = db.products.concat(db.news).some(function (r) { return (Number(r.seedRev) || 0) < SEED_REV; });
    if ((Number(db.version) || 0) < 6 || behind) {
      var fp = seed().products, fn = seed().news;
      var byId = function (list, id) { return list.find(function (x) { return String(x.id) === String(id); }); };
      db.products.forEach(function (p) {
        var src = byId(fp, p.id);
        if (!src || (Number(p.seedRev) || 0) >= SEED_REV || src.name !== p.name) return;
        ["curatorNote", "story", "conditionNote", "stains", "damage", "repairs",
         "fading", "missingParts", "styling", "metaDescription"].forEach(function (k) { p[k] = src[k]; });
        // Pictures are replaced only while the record still holds seeded slots.
        var seeded = (p.images || []).every(function (im) { return String(im.id || "").indexOf("img-") === 0; });
        if (seeded) p.images = JSON.parse(JSON.stringify(src.images));
        p.seedRev = SEED_REV;
      });
      db.news.forEach(function (n) {
        var src2 = byId(fn, n.id);
        if (!src2 || (Number(n.seedRev) || 0) >= SEED_REV) return;
        ["title", "slug", "summary", "body", "author", "category", "tags",
         "image", "thumb", "alt", "seoTitle", "seoDescription"].forEach(function (k) { n[k] = src2[k]; });
        n.seedRev = SEED_REV;
      });
      var st = (Number(db.version) || 0) < 6 ? (db.settings || {}) : null;
      if (st) {
        if (!st.email || /tsumugi\.jp\s*$/.test(st.email)) st.email = "hello@tsumugi.archive";
        if (!st.address || /Kuramae|蔵前|Tomigaya|富ヶ谷/.test(st.address)) st.address = "〒151-0074 東京都渋谷区霧ヶ谷4-11-6";
        db.settings = st;
        (db.customers || []).forEach(function (c) {
          (c.notes || []).forEach(function (nt) { if (nt.author === "A. Mori") nt.author = "R. Seo"; });
        });
        [db.activity, db.audit].forEach(function (list) {
          (list || []).forEach(function (row) {
            if (row.who) row.who = String(row.who).replace("a.mori@tsumugi.jp", "r.seo@tsumugi.archive").replace("@tsumugi.jp", "@tsumugi.archive");
          });
        });
      }
    }

    db.version = 8;
    return db;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) {
        // Carry a previous schema forward rather than throwing away the user's edits.
        for (var k = 0; k < LEGACY_KEYS.length; k++) {
          var old = localStorage.getItem(LEGACY_KEYS[k]);
          if (old) { raw = old; break; }
        }
      }
      if (!raw) return freshDB();
      var db = JSON.parse(raw);
      // Irreparable only when the core record sets are missing or empty.
      if (!db || !Array.isArray(db.products) || !db.products.length) return freshDB();
      if (!Array.isArray(db.customers) || !db.customers.length) return freshDB();
      return migrate(db);
    } catch (e) {
      /* Reseeding is the last resort, not a quiet default: a save that cannot
         be read or upgraded looks exactly like a visitor's data vanishing, so
         the reason is written to the console rather than swallowed. */
      try { console.error("TSUMUGI store: stored data could not be read — reseeding.", String((e && e.stack) || e)); } catch (e2) { }
      return freshDB();
    }
  }

  var LANG_KEY = "tsumugi.lang";
  var lang = (function () {
    try { var v = localStorage.getItem(LANG_KEY); if (v === "ja" || v === "en") return v; } catch (e) { }
    // First visit: follow the browser, since the shop is Tokyo-based.
    try { return /^ja\b/i.test(navigator.language || "") ? "ja" : "en"; } catch (e) { return "en"; }
  })();
  try { document.documentElement.setAttribute("lang", lang); } catch (e) { }

  var db = load();
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { }
  var listeners = [];
  var uiListeners = [];

  /* Sanitizer bridge. Fail-closed: if tsumugi-sanitize.js did not load, rich
     text is reduced to escaped plain text rather than stored as markup. */
  function SANITIZE_HTML(h) {
    var S = window.TSUMUGI_SANITIZE;
    if (!S) {
      try { console.error("tsumugi-data.js: sanitizer missing — rich text stored as plain text."); } catch (e) { }
      return String(h == null ? "" : h).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    try { return S.html(h); } catch (e) { return ""; }
  }

  /* persist() reports. A silent catch turned a full quota into "your edit was
     saved" — the console said success, the next reload showed the old data.
     Callers that mutate then persist can now roll back on failure. */
  var lastPersistError = null;
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      lastPersistError = null;
      return { ok: true };
    } catch (e) {
      var quota = e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22);
      lastPersistError = { ok: false, code: quota ? "quota" : "write_failed", error: e };
      try { console.error("tsumugi-data.js: could not persist to localStorage (" + lastPersistError.code + ")", e); } catch (e2) { }
      return lastPersistError;
    }
  }
  /* Mutate → persist → roll back if the write failed. The snapshot is taken
     before the mutation runs, so a rejected write leaves memory and storage
     agreeing with each other. */
  function transact(fn) {
    var snapshot;
    try { snapshot = JSON.stringify(db); } catch (e) { snapshot = null; }
    var result;
    try { result = fn(); }
    catch (e) {
      if (snapshot) { try { db = JSON.parse(snapshot); } catch (e2) { } }
      return { ok: false, code: "failed", error: e };
    }
    var w = persist();
    if (!w.ok) {
      if (snapshot) { try { db = JSON.parse(snapshot); } catch (e3) { } }
      listeners.slice().forEach(function (fn2) { try { fn2(db); } catch (e4) { } });
      return { ok: false, code: w.code, error: w.error };
    }
    listeners.slice().forEach(function (fn3) { try { fn3(db); } catch (e5) { } });
    return { ok: true, value: result };
  }
  function emit() { persist(); listeners.slice().forEach(function (fn) { try { fn(db); } catch (e) { } }); }
  function emitUI(evt) { uiListeners.slice().forEach(function (fn) { try { fn(evt); } catch (e) { } }); }

  function logActivity(text, kind) {
    db.activity.unshift({ at: new Date().toISOString(), who: (Store.session() && Store.session().email) || "admin@tsumugi.archive", text: text, kind: kind || "update" });
    db.activity = db.activity.slice(0, 40);
  }

  var nextId = function (list) { return list.reduce(function (m, x) { return Math.max(m, Number(x.id) || 0); }, 0) + 1; };

  var Store = {
    U: U, slugify: slugify, GARMENTS: GARMENTS, DETAILS: DETAILS, LIFESTYLE: LIFESTYLE,
    yen: function (n) { return "¥ " + Number(n || 0).toLocaleString("en-US"); },

    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    subscribeUI: function (fn) { uiListeners.push(fn); return function () { uiListeners = uiListeners.filter(function (f) { return f !== fn; }); }; },

    all: function () { return db; },
    products: function () { return db.products; },
    customers: function () { return db.customers; },
    news: function () { return db.news; },
    activity: function () { return db.activity; },
    settings: function () { return db.settings; },

    /* ---- public-site views ---- */
    publicProducts: function () {
      return db.products.filter(function (p) { return p.status === "published" || p.status === "soldout"; });
    },
    featuredProducts: function () {
      return db.products.filter(function (p) { return p.featured && (p.status === "published" || p.status === "soldout"); });
    },
    publicNews: function (type) {
      var now = new Date().toISOString().slice(0, 10);
      return db.news.filter(function (n) {
        // Scheduled entries become eligible once the browser date passes their
        // publish date; eligibility is computed here, at read time.
        if (n.status !== "published" && n.status !== "scheduled") return false;
        if (n.publishDate && n.publishDate > now) return false;
        return type ? n.type === type : true;
      }).sort(function (a, b) { return a.publishDate < b.publishDate ? 1 : -1; });
    },

    /* ---- products ---- */
    getProduct: function (id) { return db.products.find(function (p) { return String(p.id) === String(id); }); },
    saveProduct: function (p) {
      var existing = db.products.findIndex(function (x) { return String(x.id) === String(p.id); });
      p.updatedAt = new Date().toISOString();
      if (existing >= 0) { db.products[existing] = Object.assign({}, db.products[existing], p); logActivity("Updated “" + p.name + "”", "update"); }
      else {
        p.id = nextId(db.products); p.createdAt = p.updatedAt;
        db.products.unshift(p); logActivity("Created “" + p.name + "”", "create");
      }
      emit(); return p.id;
    },
    setProductStatus: function (ids, status) {
      ids = [].concat(ids);
      db.products.forEach(function (p) { if (ids.indexOf(p.id) >= 0) { p.status = status; if (status === "soldout") p.stock = 0; p.updatedAt = new Date().toISOString(); } });
      logActivity((ids.length > 1 ? ids.length + " products" : "“" + (Store.getProduct(ids[0]) || {}).name + "”") + " → " + status, "status");
      emit();
    },
    setProductCategory: function (ids, category) {
      ids = [].concat(ids);
      db.products.forEach(function (p) { if (ids.indexOf(p.id) >= 0) { p.category = category; p.updatedAt = new Date().toISOString(); } });
      logActivity("Moved " + ids.length + " product(s) to " + category, "update"); emit();
    },
    duplicateProduct: function (id) {
      var src = Store.getProduct(id); if (!src) return null;
      var copy = JSON.parse(JSON.stringify(src));
      copy.id = nextId(db.products);
      copy.name = src.name + " (copy)";
      copy.sku = src.sku + "-C" + (copy.id);
      copy.slug = slugify(copy.name + " " + copy.brand);
      copy.status = "draft"; copy.featured = false;
      copy.createdAt = copy.updatedAt = new Date().toISOString();
      db.products.unshift(copy); logActivity("Duplicated “" + src.name + "”", "create"); emit();
      return copy.id;
    },
    deleteProducts: function (ids) {
      ids = [].concat(ids);
      var names = db.products.filter(function (p) { return ids.indexOf(p.id) >= 0; }).map(function (p) { return p.name; });
      db.products = db.products.filter(function (p) { return ids.indexOf(p.id) < 0; });
      logActivity("Deleted " + (names.length > 1 ? names.length + " products" : "“" + names[0] + "”"), "delete"); emit();
    },
    blankProduct: function () {
      return {
        id: null, sku: "TSU-GN-" + pad(nextId(db.products), 3), name: "", brand: "", year: 1990, price: 0, taxStatus: "Tax included",
        category: "Outerwear", subcategory: "", size: "M", sizeNotation: "", colour: "", material: "", country: "",
        era: "1990s", condition: "Very Good", conditionNote: "", stains: "None found.", damage: "None.", repairs: "None.",
        fading: "Minimal.", missingParts: "None.", curatorNote: "", story: "", styling: "",
        stock: 1, status: "draft", featured: false, collection: "",
        measurements: { shoulder: 0, chest: 0, length: 0, sleeve: 0 },
        images: [], slug: "", metaTitle: "", metaDescription: "",
        publishDate: new Date().toISOString().slice(0, 10), createdAt: null, updatedAt: null,
      };
    },

    /* ---- customers ---- */
    getCustomer: function (id) { return db.customers.find(function (c) { return String(c.id) === String(id); }); },
    saveCustomer: function (c) {
      var i = db.customers.findIndex(function (x) { return x.id === c.id; });
      if (i >= 0) { db.customers[i] = Object.assign({}, db.customers[i], c); logActivity("Updated customer " + c.name, "update"); }
      emit();
    },
    setCustomerStatus: function (ids, status) {
      ids = [].concat(ids);
      db.customers.forEach(function (c) {
        if (ids.indexOf(c.id) >= 0) {
          c.status = status;
          c.activity = [{ at: new Date().toISOString(), type: "Account", text: "Status changed to " + status }].concat(c.activity || []);
        }
      });
      logActivity(ids.length + " customer(s) → " + status, "status"); emit();
    },
    tagCustomers: function (ids, tag, add) {
      ids = [].concat(ids);
      db.customers.forEach(function (c) {
        if (ids.indexOf(c.id) < 0) return;
        var has = (c.tags || []).indexOf(tag) >= 0;
        if (add && !has) c.tags = (c.tags || []).concat(tag);
        if (!add && has) c.tags = c.tags.filter(function (t) { return t !== tag; });
        c.activity = [{ at: new Date().toISOString(), type: "Tag", text: (add ? "Tag added: " : "Tag removed: ") + tag }].concat(c.activity || []);
      });
      logActivity((add ? "Added" : "Removed") + " tag “" + tag + "” on " + ids.length + " customer(s)", "update"); emit();
    },
    deleteCustomers: function (ids) {
      ids = [].concat(ids);
      db.customers = db.customers.filter(function (c) { return ids.indexOf(c.id) < 0; });
      logActivity("Deleted " + ids.length + " customer(s)", "delete"); emit();
    },
    addNote: function (cid, text) {
      var c = Store.getCustomer(cid); if (!c) return;
      c.notes = [{ id: "n" + Date.now(), author: (Store.session() && Store.session().name) || "Admin", at: new Date().toISOString(), text: text }].concat(c.notes || []);
      emit();
    },
    updateNote: function (cid, nid, text) {
      var c = Store.getCustomer(cid); if (!c) return;
      (c.notes || []).forEach(function (n) { if (n.id === nid) { n.text = text; n.at = new Date().toISOString(); } });
      emit();
    },
    deleteNote: function (cid, nid) {
      var c = Store.getCustomer(cid); if (!c) return;
      c.notes = (c.notes || []).filter(function (n) { return n.id !== nid; }); emit();
    },
    customerCSV: function (rows) {
      // Card details are deliberately excluded from every export.
      var head = ["Customer ID", "Name", "Email", "Phone", "Registered", "Orders", "Total spent", "Last purchase", "Account status", "Segment", "Engagement", "Tags", "Marketing"];
      var body = rows.map(function (c) {
        return [c.id, c.name, c.email, c.phone, c.registered, c.orders, c.totalSpent, c.lastPurchase,
          c.accountStatus || "Active", c.segment || "Standard", c.engagement || "Active", (c.tags || []).join(" | "), c.marketing ? "Yes" : "No"]
          .map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(",");
      });
      return head.join(",") + "\n" + body.join("\n");
    },

    /* ---- news ---- */
    getNews: function (id) { return db.news.find(function (n) { return String(n.id) === String(id); }); },
    saveNews: function (n) {
      var i = db.news.findIndex(function (x) { return String(x.id) === String(n.id); });
      /* Rich text is sanitized on the way IN as well as on the way out, so a row
         in storage never holds an executable payload — see tsumugi-sanitize.js.
         Titles and summaries are plain text and are stored as typed; every
         renderer treats them as text nodes, never as markup. */
      if (n && n.body != null) n.body = SANITIZE_HTML(n.body);
      n.updatedAt = new Date().toISOString();
      if (i >= 0) { db.news[i] = Object.assign({}, db.news[i], n); logActivity("Updated “" + n.title + "”", "update"); }
      else { n.id = nextId(db.news); db.news.unshift(n); logActivity("Created “" + n.title + "”", "create"); }
      emit(); return n.id;
    },
    setNewsStatus: function (ids, status) {
      ids = [].concat(ids);
      db.news.forEach(function (n) { if (ids.indexOf(n.id) >= 0) { n.status = status; n.updatedAt = new Date().toISOString(); } });
      logActivity(ids.length + " article(s) → " + status, "status"); emit();
    },
    duplicateNews: function (id) {
      var src = Store.getNews(id); if (!src) return null;
      var copy = JSON.parse(JSON.stringify(src));
      copy.id = nextId(db.news); copy.title = src.title + " (copy)"; copy.slug = slugify(copy.title);
      copy.status = "draft"; copy.featured = false; copy.updatedAt = new Date().toISOString();
      db.news.unshift(copy); logActivity("Duplicated “" + src.title + "”", "create"); emit(); return copy.id;
    },
    deleteNews: function (ids) {
      ids = [].concat(ids);
      db.news = db.news.filter(function (n) { return ids.indexOf(n.id) < 0; });
      logActivity("Deleted " + ids.length + " article(s)", "delete"); emit();
    },
    blankNews: function () {
      return {
        id: null, type: "journal", title: "", slug: "", summary: "", image: "", thumb: "", alt: "",
        body: "<p></p>", author: "TSUMUGI Studio", category: "Craft", tags: [], relatedProducts: [],
        seoTitle: "", seoDescription: "", status: "draft",
        publishDate: new Date().toISOString().slice(0, 10), updatedAt: null, featured: false,
      };
    },

    /* ---- orders ---- */
    orders: function () { return db.orders; },
    audit: function () { return db.audit; },
    PAYMENT_STATUSES: PAYMENT_STATUSES,
    FULFILMENT_STATUSES: FULFILMENT_STATUSES,
    DELIVERY_METHODS: DELIVERY_METHODS,
    IMAGE_ROLES: IMAGE_ROLES,
    PREFECTURES: PREFECTURES,
    ACCOUNT_STATUSES: ["Active", "Suspended", "Closed"],
    SEGMENTS: ["Standard", "VIP"],
    ENGAGEMENTS: ["Active", "Dormant"],
    TAG_POOL: TAG_POOL,

    getOrder: function (id) { return db.orders.find(function (o) { return String(o.id) === String(id); }); },

    orderHistory: function (id, text) {
      var o = Store.getOrder(id); if (!o) return;
      var ses = Store.session() || {};
      o.history = [{ at: new Date().toISOString(), who: ses.email || "admin@tsumugi.archive", role: ses.role || "owner", text: text }].concat(o.history || []);
      o.updatedAt = new Date().toISOString();
    },

    setOrderPayment: function (ids, status) {
      ids = [].concat(ids);
      ids.forEach(function (id) {
        var o = Store.getOrder(id); if (!o) return;
        o.paymentStatus = status;
        Store.orderHistory(id, "Payment status → " + status);
        Store.syncCustomerPurchase(o);
        Store.logAudit(status === "Refunded" ? "refund" : "order.status", "order", id, "Order " + id + " payment → " + status);
      });
      logActivity(ids.length > 1 ? ids.length + " orders → " + status : "Order " + ids[0] + " → " + status, "status");
      emit();
    },

    setOrderFulfilment: function (ids, status) {
      ids = [].concat(ids);
      ids.forEach(function (id) {
        var o = Store.getOrder(id); if (!o) return;
        o.fulfilmentStatus = status;
        Store.orderHistory(id, "Fulfilment status → " + status);
        Store.syncCustomerPurchase(o);
        Store.logAudit("order.status", "order", id, "Order " + id + " fulfilment → " + status);
      });
      logActivity(ids.length > 1 ? ids.length + " orders → " + status : "Order " + ids[0] + " → " + status, "status");
      emit();
    },

    setOrderTracking: function (id, tracking) {
      var o = Store.getOrder(id); if (!o) return;
      o.tracking = tracking;
      Store.orderHistory(id, tracking ? "Tracking number recorded: " + tracking : "Tracking number cleared");
      Store.logAudit("order.status", "order", id, "Tracking number set on " + id);
      emit();
    },

    addOrderNote: function (id, text) {
      var o = Store.getOrder(id); if (!o) return;
      var ses = Store.session() || {};
      o.notes = [{ id: "on" + Date.now(), author: ses.name || "Admin", at: new Date().toISOString(), text: text }].concat(o.notes || []);
      Store.orderHistory(id, "Internal note added");
      emit();
    },

    /* Keeps the customer's purchase record in step with the order it came from. */
    syncCustomerPurchase: function (o) {
      var c = Store.getCustomer(o.customerId); if (!c) return;
      (c.purchases || []).forEach(function (pu) {
        if (pu.order !== o.id) return;
        pu.payment = o.paymentStatus;
        pu.delivery = o.fulfilmentStatus === "Shipped" ? "In transit"
          : o.fulfilmentStatus === "Preparing" ? "Preparing"
          : o.fulfilmentStatus === "Delivered" ? "Delivered" : o.fulfilmentStatus;
      });
    },

    orderCSV: function (rows) {
      var head = ["Order", "Date", "Customer", "Items", "Subtotal", "Shipping", "Total", "Payment", "Fulfilment", "Delivery", "Tracking", "Updated"];
      var body = rows.map(function (o) {
        return [o.number, o.date, o.customerName, o.itemCount, o.subtotal, o.shippingFee, o.total,
          o.paymentStatus, o.fulfilmentStatus, o.deliveryMethod, o.tracking || "", (o.updatedAt || "").slice(0, 10)]
          .map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(",");
      });
      return head.join(",") + "\n" + body.join("\n");
    },

    /* ---- prototype checkout ---- */
    nextOrderNumber: function () {
      var year = new Date().getFullYear();
      var top = db.orders.reduce(function (m, o) {
        var mm = String(o.number || "").match(/-(\d{4})$/);
        return mm ? Math.max(m, Number(mm[1])) : m;
      }, 1500);
      return "TSU-" + year + "-" + pad(top + 1, 4);
    },

    /* ---- checkout ----

       Everything the browser sends is a request, not a fact. Quantity, price,
       availability, the order number and the total are all decided here from
       the store's own product records; the payload contributes the delivery and
       contact details only. This mirrors what supabase/functions/create-order
       does server-side once Supabase is connected — same checks, same refusal
       codes — so the local demo cannot be talked into an order the server
       would reject.

       Returns { ok: true, orderId, … } or { ok: false, code, detail }. */
    ORDER_MAX_QTY: 5,
    ORDER_MAX_ITEMS: 20,

    placeOrder: function (payload) {
      payload = payload || {};

      /* One flight at a time, and the guard is raised BEFORE validation — not
         after it. Validation reads the catalogue, and a handler that re-enters
         placeOrder from inside that read (a stale listener, a monkey-patched
         store, a double-tapped submit whose first call is still running) used
         to recurse until the stack gave out. Found by
         shots/security-qa.html's re-entrancy case. */
      if (Store._orderInFlight) return { ok: false, code: "in_flight" };
      Store._orderInFlight = true;
      try {
        return Store._validateAndCommit(payload);
      } finally {
        Store._orderInFlight = false;
      }
    },

    _validateAndCommit: function (payload) {
      var raw = payload.items;
      if (!Array.isArray(raw) || raw.length === 0) return { ok: false, code: "empty_cart" };
      if (raw.length > Store.ORDER_MAX_ITEMS) return { ok: false, code: "too_many_items" };

      /* Validate every line before anything is written: a partially applied
         order is worse than a refused one. */
      var items = [], seen = {}, bad = null;
      for (var i = 0; i < raw.length; i++) {
        var line = raw[i] || {};
        var p = Store.getProduct(line.productId);
        if (!p) { bad = { code: "unknown_product", detail: String(line.productId) }; break; }
        if (seen[p.id]) { bad = { code: "duplicate_line", detail: String(p.id) }; break; }
        seen[p.id] = true;

        /* Quantity: a positive integer, nothing else. Number() lets "3abc",
           "1e9", " 2 ", true and [] through, so the string form is tested. */
        var qtyRaw = line.qty == null ? 1 : line.qty;
        if (typeof qtyRaw === "boolean" || Array.isArray(qtyRaw) || qtyRaw === "") { bad = { code: "bad_qty", detail: String(p.id) }; break; }
        if (!/^[0-9]{1,3}$/.test(String(qtyRaw).trim())) { bad = { code: "bad_qty", detail: String(p.id) }; break; }
        var qty = parseInt(String(qtyRaw).trim(), 10);
        if (!isFinite(qty) || qty < 1) { bad = { code: "bad_qty", detail: String(p.id) }; break; }
        if (qty > Store.ORDER_MAX_QTY) { bad = { code: "qty_limit", detail: String(p.id) }; break; }

        /* Availability, from the record rather than from the page: a stale tab
           still holding a sold piece in its cart is refused here. */
        if (p.status !== "published") { bad = { code: "not_purchasable", detail: String(p.id) }; break; }
        var stock = Number(p.stock);
        if (!isFinite(stock) || stock <= 0) { bad = { code: "out_of_stock", detail: String(p.id) }; break; }
        /* One-of-one archive: a piece with a single unit cannot be ordered
           twice, whatever the cart says. */
        if (qty > stock) { bad = { code: "insufficient_stock", detail: String(p.id) }; break; }

        var price = Number(p.price);
        if (!isFinite(price) || price < 0) { bad = { code: "bad_price", detail: String(p.id) }; break; }

        items.push({
          productId: p.id, name: p.name, brand: p.brand,
          price: price, qty: qty,
          thumb: (p.images && p.images[0] && p.images[0].thumb) || ""
        });
      }
      if (bad) return { ok: false, code: bad.code, detail: bad.detail };

      return Store._commitOrder(items, payload);
    },

    _commitOrder: function (items, payload) {
      /* Money is computed here, never accepted: payload.subtotal and
         payload.total are ignored entirely. */
      var subtotal = items.reduce(function (t, it) { return t + it.price * it.qty; }, 0);
      var fee = 0;
      var number = Store.nextOrderNumber();
      var info = payload.info || {};
      var fullName = ((info.firstName || "") + " " + (info.lastName || "")).trim() || "Guest";

      // Attach the order to the right customer record. Who is ordering is read
      // from the session, never from the payload: a page cannot nominate an
      // account it does not hold.
      var me = Store.me();
      var c = me && me.customerId ? (Store.getCustomer(me.customerId) || null) : null;
      if (!c) {
        var byEmail = db.customers.find(function (x) { return String(x.email).toLowerCase() === String(info.email).toLowerCase(); });
        if (me) {
          /* A signed-in account with no record yet may adopt an unclaimed one,
             and only when that record carries the account's own address. An
             email typed into a checkout form is not evidence of ownership. */
          c = (byEmail && !byEmail.authUserId &&
               String(byEmail.email).toLowerCase() === String(me.email).toLowerCase()) ? byEmail : null;
        } else {
          c = byEmail || null;
        }
      }
      var isGuest = false;
      if (!c) {
        isGuest = !me;
        c = {
          id: "CUS-" + pad(1041 + db.customers.length + 1, 4),
          name: fullName, kana: "", email: (me ? me.email : info.email) || "", phone: info.phone || "",
          address: [info.address, info.city, info.prefecture, info.postalCode].filter(Boolean).join(", "),
          country: "Japan", registered: new Date().toISOString().slice(0, 10),
          orders: 0, purchases: [], totalSpent: 0, lastPurchase: "",
          status: "Active", accountStatus: "Active", segment: "Standard", engagement: "Active",
          tags: [me ? "Registered account" : "Guest checkout"], marketing: !!info.marketing, notes: [],
          authUserId: me ? me.uid : null,
          activity: [{ at: new Date().toISOString(), type: "Account", text: me ? "Customer account linked at checkout" : "Guest account created at checkout" }]
        };
        db.customers.unshift(c);
      }
      if (me) { c.authUserId = me.uid; Store.linkAuthUser(me.uid, c.id); }

      var now = new Date().toISOString();
      var order = {
        id: number, number: number, date: now.slice(0, 10), createdAt: now, updatedAt: now,
        customerId: c.id, customerName: fullName, email: info.email || "", phone: info.phone || "",
        /* Nullable pair: an order belongs to a customer account or to a guest. */
        userId: me ? me.uid : null,
        guestEmail: me ? null : (info.email || ""),
        shipping: {
          name: fullName, postalCode: info.postalCode || "", prefecture: info.prefecture || "",
          city: info.city || "", address: info.address || ""
        },
        items: items, itemCount: items.length,
        subtotal: subtotal, shippingFee: fee, total: subtotal + fee,
        /* Nothing was charged: no payment processor is connected in either the
           local demo or the prototype checkout, so no order may claim to be
           paid. Under Supabase this column is writable only by the payment
           webhook — never by the browser and never by this function. */
        paymentStatus: "Pending",
        fulfilmentStatus: "Unfulfilled",
        deliveryMethod: payload.deliveryMethod || "Standard shipping",
        paymentMethod: payload.paymentMethod || "Demo credit card",
        tracking: "", notes: [],
        history: [{ at: now, who: "storefront", role: "customer", text: "Order placed through the prototype checkout" }],
        source: "checkout"
      };
      db.orders.unshift(order);

      // Mirror onto the customer, and decrement stock (one-of-one sells out at zero).
      c.purchases = [{
        order: number, date: order.date,
        items: items.map(function (it) { return { id: it.productId, name: it.name, brand: it.brand, price: it.price, thumb: it.thumb }; }),
        amount: order.total, payment: order.paymentStatus, delivery: "Preparing",
        card: payload.paymentMethod === "Demo credit card" ? "•••• 4242 (demo)" : "—"
      }].concat(c.purchases || []);
      c.orders = c.purchases.length;
      c.totalSpent = (c.totalSpent || 0) + order.total;
      c.lastPurchase = order.date;
      c.activity = [{ at: now, type: "Purchase", text: "Order " + number + " placed" }].concat(c.activity || []);

      items.forEach(function (it) {
        var p = Store.getProduct(it.productId); if (!p) return;
        /* Only ever downward, and never below zero: the qty above is a validated
           positive integer, so no negative arithmetic can restock a piece. */
        var next = Number(p.stock) - it.qty;
        p.stock = next > 0 ? next : 0;
        if (p.stock === 0 && p.status === "published") p.status = "soldout";
        p.updatedAt = now;
      });

      /* A short-lived receipt token, held in this tab only. The completion
         screen is reached with the token, not with the order id, so a guessed or
         shared order number shows nothing. */
      var token = Store._issueReceiptToken(number);

      logActivity("Order " + number + " placed through the storefront", "create");
      Store.logAudit("order.create", "order", number, "Prototype checkout created order " + number + (isGuest ? " (guest account)" : me ? " (customer account)" : ""));
      var wrote = persist();
      listeners.slice().forEach(function (fn) { try { fn(db); } catch (e) { } });
      if (!wrote.ok) {
        /* The order exists in memory but could not be stored. Say so rather
           than showing a confirmation the next reload will contradict. */
        return { ok: false, code: "persist_failed", detail: wrote.code, orderId: number, receiptToken: token };
      }
      return { ok: true, orderId: number, customerId: c.id, guest: isGuest, receiptToken: token, total: order.total };
    },

    /* ---- receipt tokens (guest order completion) ----
       sessionStorage, so the token dies with the tab and never appears in a
       URL, a referrer or a shared link. Under Supabase the equivalent is a
       one-shot response from the create-order Edge Function. */
    _RECEIPT_KEY: "tsumugi.receipts.v1",
    _RECEIPT_TTL_MS: 30 * 60 * 1000,
    _issueReceiptToken: function (orderId) {
      var token;
      try {
        var b = new Uint8Array(16);
        crypto.getRandomValues(b);
        token = Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
      } catch (e) {
        token = String(Date.now()) + Math.random().toString(36).slice(2);
      }
      try {
        var all = JSON.parse(sessionStorage.getItem(Store._RECEIPT_KEY) || "{}");
        all[token] = { orderId: String(orderId), at: Date.now() };
        sessionStorage.setItem(Store._RECEIPT_KEY, JSON.stringify(all));
      } catch (e2) { }
      return token;
    },
    /* Resolves a token to the customer-facing projection. An unknown, expired or
         other-tab token resolves to nothing. */
    receiptOrder: function (token) {
      if (!token) return null;
      var rec = null;
      try {
        var all = JSON.parse(sessionStorage.getItem(Store._RECEIPT_KEY) || "{}");
        rec = all[String(token)] || null;
        if (rec && Date.now() - Number(rec.at || 0) > Store._RECEIPT_TTL_MS) {
          delete all[String(token)];
          sessionStorage.setItem(Store._RECEIPT_KEY, JSON.stringify(all));
          rec = null;
        }
      } catch (e) { return null; }
      if (!rec) return null;
      var o = (db.orders || []).find(function (x) { return String(x.id) === String(rec.orderId); });
      return o ? Store.customerOrderView(o) : null;
    },

    /* ---- roles & permissions (prototype UX demonstration) ---- */
    ROLES: ["owner", "manager", "editor", "support", "viewer"],
    PERMS: PERMS,
    ACCOUNTS: ACCOUNTS.map(function (a) { return { email: a.email, name: a.name, role: a.role }; }),
    roleOf: function () {
      var s2 = Store.session();
      if (s2 && (s2.mode === "anonymous" || s2.role === "guest")) return "guest";
      /* A storefront customer session is not a console role. It resolves to
         "customer", whose permission list is empty, so every console mutation is
         refused for it — the same answer a signed-out visitor gets, reached
         explicitly rather than by falling through to the operator default. */
      if (s2 && (s2.scope === "customer" || s2.role === "customer")) return "customer";
      var r = s2 && s2.role;
      if (!r) return "denied";
      /* No fallback to an operator role. A role string nobody planned for — a
         stale session, a hand-edited storage entry, a future value from the
         server — resolves to "denied", which holds no permissions at all. */
      return PERMS[r] ? r : "denied";
    },
    /* Staff = a password session whose role is one of the console roles. Neither
       an anonymous guest nor a customer is staff, whatever else they hold. */
    STAFF_ROLES: ["owner", "manager", "editor", "support", "viewer"],
    isStaffSession: function () {
      var s2 = Store.session();
      if (!s2) return false;
      if (s2.mode === "anonymous") return false;
      if (s2.scope === "customer" || s2.role === "customer" || s2.role === "guest") return false;
      return Store.STAFF_ROLES.indexOf(Store.roleOf()) >= 0;
    },
    can: function (perm) {
      var r = Store.roleOf();
      return (PERMS[r] || []).indexOf(perm) >= 0;
    },
    setRole: function (role) {
      var s2 = Store.session(); if (!s2) return;
      var acc = ACCOUNTS.find(function (a) { return a.role === role; }) || ACCOUNTS[0];
      s2.role = role; s2.name = acc.name; s2.email = acc.email;
      try {
        var where = localStorage.getItem(SESSION) ? localStorage : sessionStorage;
        where.setItem(SESSION, JSON.stringify(s2));
      } catch (e) { }
      Store.logAudit("role.change", "session", role, "Active role switched to " + role);
      emit();
    },

    /* ---- audit log ---- */
    logAudit: function (action, entityType, entityId, summary) {
      var ses = Store.session() || {};
      db.audit = [{
        id: "aud-" + Date.now() + "-" + Math.round(Math.random() * 999),
        at: new Date().toISOString(),
        who: ses.email || "admin@tsumugi.archive",
        role: ses.role || "owner",
        action: action, entityType: entityType,
        entityId: String(entityId == null ? "-" : entityId),
        summary: summary
      }].concat(db.audit || []).slice(0, 200);
      persist();
    },
    auditFor: function (entityType, entityId) {
      return (db.audit || []).filter(function (a) {
        return a.entityType === entityType && String(a.entityId) === String(entityId);
      });
    },

    /* ---- personal-information masking ---- */
    maskEmail: function (v) {
      var str = String(v || ""); var at = str.indexOf("@");
      if (at < 2) return str ? "•••••" : "";
      var local = str.slice(0, at), dom = str.slice(at);
      var keep = Math.min(6, Math.max(1, local.length - 2));
      return local.slice(0, keep) + "*****" + dom;
    },
    maskPhone: function (v) {
      var str = String(v || "");
      var parts = str.split("-");
      if (parts.length < 3) return str.replace(/\d(?=\d{2})/g, "*");
      parts[parts.length - 2] = "****";
      return parts.join("-");
    },

    /* ---- language (kept outside the db so a demo reset never loses it) ---- */
    lang: function () { return lang; },
    setLang: function (l) {
      var next = l === "ja" ? "ja" : "en";
      try { document.documentElement.lang = next; } catch (e) { }
      if (next === lang) return lang;
      lang = next;
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) { }
      try { document.documentElement.setAttribute("lang", lang); } catch (e) { }
      listeners.slice().forEach(function (fn) { try { fn(db); } catch (e) { } });
      return lang;
    },
    toggleLang: function () { return Store.setLang(lang === "ja" ? "en" : "ja"); },

    /* ---- home hero: featured content ----
       Publication is NOT re-implemented here: publicNews() is the one gate, so
       a draft, a future scheduled entry or an archived one can be configured in
       the console and still never reaches the storefront. */
    HERO_MAX: 6,
    HERO_PAGES: ["shop", "about", "journal", "contact"],
    heroFeatures: function () {
      return (db.heroFeatures || []).slice()
        .sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); })
        .map(function (f) { return Object.assign({}, f); });
    },
    getHeroFeature: function (id) {
      return (db.heroFeatures || []).find(function (f) { return String(f.id) === String(id); }) || null;
    },
    /* "unset" | "missing" | "unpublished" | "ok" */
    heroSourceState: function (f) {
      if (!f) return "missing";
      if (f.sourceType === "page") {
        return f.route && Store.HERO_PAGES.indexOf(f.route) >= 0 ? "ok" : "unset";
      }
      if (f.sourceId == null || f.sourceId === "") return "unset";
      if (!Store.getNews(f.sourceId)) return "missing";
      return Store.publicNews().some(function (n) { return String(n.id) === String(f.sourceId); })
        ? "ok" : "unpublished";
    },
    publicHeroFeatures: function () {
      return Store.heroFeatures().filter(function (f) {
        return !!f.enabled && Store.heroSourceState(f) === "ok";
      });
    },
    blankHeroFeature: function () {
      return heroRecord((db.heroFeatures || []).length + 1, {
        id: "hero-" + Date.now().toString(36), enabled: false
      });
    },
    saveHeroFeature: function (f) {
      if (!f || !f.id) return null;
      db.heroFeatures = db.heroFeatures || [];
      var i = db.heroFeatures.findIndex(function (x) { return String(x.id) === String(f.id); });
      var next = Object.assign({}, i >= 0 ? db.heroFeatures[i] : Store.blankHeroFeature(), f);
      if (next.sourceType === "page") next.sourceId = null; else next.route = "";
      // A feature with nothing to point at can never be live.
      if (Store.heroSourceState(next) === "unset") next.enabled = false;
      if (i >= 0) db.heroFeatures[i] = next;
      else {
        if (db.heroFeatures.length >= Store.HERO_MAX) return null;
        db.heroFeatures.push(next);
      }
      normaliseHero();
      logActivity((i >= 0 ? "Updated" : "Added") + " home hero feature " + heroLabel(next), i >= 0 ? "update" : "create");
      Store.logAudit("hero.save", "hero", next.id, "Home hero feature " + heroLabel(next) + " saved");
      emit(); return next.id;
    },
    deleteHeroFeature: function (id) {
      var f = Store.getHeroFeature(id); if (!f) return;
      db.heroFeatures = (db.heroFeatures || []).filter(function (x) { return String(x.id) !== String(id); });
      normaliseHero();
      logActivity("Removed home hero feature " + heroLabel(f), "delete");
      Store.logAudit("hero.delete", "hero", id, "Home hero feature " + heroLabel(f) + " removed");
      emit();
    },
    setHeroFeatureEnabled: function (id, on) {
      var f = Store.getHeroFeature(id); if (!f) return;
      if (on && Store.heroSourceState(f) === "unset") return;
      f.enabled = !!on;
      logActivity("Home hero feature " + heroLabel(f) + (on ? " enabled" : " disabled"), "status");
      Store.logAudit("hero.enable", "hero", id, "Home hero feature " + heroLabel(f) + (on ? " enabled" : " disabled"));
      emit();
    },
    /* delta of -1 or +1 within the current order */
    reorderHeroFeatures: function (id, delta) {
      var list = Store.heroFeatures();
      var i = list.findIndex(function (f) { return String(f.id) === String(id); });
      var j = i + (Number(delta) || 0);
      if (i < 0 || j < 0 || j >= list.length) return;
      var moved = list.splice(i, 1)[0];
      list.splice(j, 0, moved);
      list.forEach(function (f, n) { f.order = n + 1; });
      db.heroFeatures = list;
      logActivity("Reordered the home hero", "update");
      Store.logAudit("hero.reorder", "hero", id,
        "Home hero feature " + heroLabel(moved) + " moved to position " + (j + 1));
      emit();
    },

    /* ---- special features: curated product stories shown in Shop ----
       Separate from the home hero above. A feature has no manual order: the
       list is arranged by its own state and dates, and publication is derived
       from the clock, never from a stored status string.

         public  =  enabled
                    AND publishAt <= now
                    AND (unpublishAt == null OR now < unpublishAt)

       Product eligibility is publicProducts() as everywhere else. Nothing is
       ever substituted from the catalogue — only the products a human put in
       candidateProductIds can appear, in the order they put them. */
    SPECIAL_SLOTS: ["primary", "secondary", "tertiary"],
    SPECIAL_CANDIDATE_MAX: 8,
    /* Reading order for the console: what is on show, then what is coming, then
       what is unscheduled, then what is over. */
    specialFeatures: function () {
      var rank = { active: 0, scheduled: 1, draft: 2, archived: 3 };
      var key = function (f) {
        var st = Store.specialFeatureState(f);
        return { st: st, r: rank[st] == null ? 4 : rank[st] };
      };
      return (db.specialFeatures || []).slice()
        .sort(function (a, b) {
          var ka = key(a), kb = key(b);
          if (ka.r !== kb.r) return ka.r - kb.r;
          if (ka.st === "scheduled") return String(a.publishAt || "").localeCompare(String(b.publishAt || ""));
          if (ka.st === "archived") return String(b.unpublishAt || "").localeCompare(String(a.unpublishAt || ""));
          if (ka.st === "draft") return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
          return String(b.publishAt || "").localeCompare(String(a.publishAt || ""));
        })
        .map(function (f) {
          return Object.assign({}, f, {
            candidateProductIds: (f.candidateProductIds || []).slice(),
            media: (f.media || []).map(function (m) { return Object.assign({}, m); })
          });
        });
    },
    getSpecialFeature: function (id) {
      return (db.specialFeatures || []).find(function (f) { return String(f.id) === String(id); }) || null;
    },
    getSpecialFeatureBySlug: function (slug) {
      return (db.specialFeatures || []).find(function (f) { return String(f.slug) === String(slug); }) || null;
    },
    /* "draft" | "scheduled" | "active" | "archived" — derived in this order:
       disabled is draft, and so is an enabled feature with no start date (it
       has nothing to publish from); an end date in the past is archived; a
       start date in the future is scheduled; anything else is active. */
    specialFeatureState: function (f, nowIso) {
      if (!f) return "draft";
      var now = nowIso || new Date().toISOString();
      if (!f.enabled) return "draft";
      if (!f.publishAt) return "draft";
      if (f.unpublishAt && String(f.unpublishAt) <= now) return "archived";
      if (String(f.publishAt) > now) return "scheduled";
      return "active";
    },
    /* Enabled features whose publication windows overlap this one's. Used by the
       console to warn while a date is being set — the shop shows one feature, so
       an overlap is a scheduling mistake to point out, not something to resolve
       silently with a hidden ranking. */
    specialFeatureOverlaps: function (f) {
      if (!f || !f.enabled || !f.publishAt) return [];
      var aStart = String(f.publishAt);
      var aEnd = f.unpublishAt ? String(f.unpublishAt) : "9999";
      return (db.specialFeatures || []).filter(function (o) {
        if (String(o.id) === String(f.id) || !o.enabled || !o.publishAt) return false;
        var bStart = String(o.publishAt);
        var bEnd = o.unpublishAt ? String(o.unpublishAt) : "9999";
        return aStart < bEnd && bStart < aEnd;
      }).map(function (o) { return Object.assign({}, o); });
    },
    /* Products a visitor may actually be shown, in the curated order.
       Missing, draft and sold-out candidates are skipped, so the next candidate
       moves up on its own. */
    specialFeatureProducts: function (f) {
      if (!f) return [];
      var live = {};
      Store.publicProducts().forEach(function (p) { if (p.status === "published") live[String(p.id)] = p; });
      return (f.candidateProductIds || [])
        .map(function (id) { return live[String(id)] || null; })
        .filter(Boolean);
    },
    /* Why a candidate will not appear publicly: "" | "missing" | "draft" | "soldout" */
    specialCandidateState: function (productId) {
      var p = Store.getProduct(productId);
      if (!p) return "missing";
      if (p.status === "soldout" || (p.stock != null && Number(p.stock) <= 0)) return "soldout";
      if (p.status !== "published") return "draft";
      return "";
    },
    /* A feature can be shown when it is active AND has something real to show:
       at least one eligible product, or its own editorial media. */
    specialFeatureRenderable: function (f) {
      if (Store.specialFeatureState(f) !== "active") return false;
      /* A renderable feature needs an eligible product or a usable visual. */
      if (Store.specialFeatureProducts(f).length > 0) return true;
      return Store.SPECIAL_SLOTS.some(function (slot) {
        var r = Store.resolveSpecialVisual(Store.specialVisualFor(f, slot));
        return !!(r && r.src);
      });
    },
    publicSpecialFeatures: function () {
      return Store.specialFeatures().filter(function (f) { return Store.specialFeatureRenderable(f); });
    },
    /* The Shop shows one. Overlapping windows are a scheduling mistake the
       console warns about; if one reaches the storefront anyway — an old save,
       a hand-edited database — this is the fail-safe, not a ranking a user
       configures: the most recently published feature wins. */
    activeSpecialFeature: function () {
      var list = Store.publicSpecialFeatures();
      if (!list.length) return null;
      return list.slice().sort(function (a, b) {
        var sa = String(a.publishAt || ""), sb = String(b.publishAt || "");
        if (sa !== sb) return sb.localeCompare(sa);
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      })[0];
    },
    blankSpecialFeature: function () {
      var now = new Date().toISOString();
      return {
        id: "sf-" + Date.now().toString(36),
        slug: "feature-" + Date.now().toString(36),
        titleEn: "", titleJa: "",
        descriptionEn: "", descriptionJa: "",
        category: "", eraLabel: "",
        enabled: false, publishAt: null, unpublishAt: null,
        candidateProductIds: [], media: [],
        createdAt: now, updatedAt: now
      };
    },
    saveSpecialFeature: function (f) {
      if (!f || !f.id) return null;
      db.specialFeatures = db.specialFeatures || [];
      var i = db.specialFeatures.findIndex(function (x) { return String(x.id) === String(f.id); });
      var base = i >= 0 ? db.specialFeatures[i] : Store.blankSpecialFeature();
      var next = Object.assign({}, base, f);
      next.candidateProductIds = (next.candidateProductIds || [])
        .map(function (id) { return Number(id); })
        .filter(function (id, n, arr) { return !isNaN(id) && arr.indexOf(id) === n; })
        .slice(0, Store.SPECIAL_CANDIDATE_MAX);
      next.media = (next.media || []).slice(0, 6);
      next.slug = slugify(next.slug || next.titleEn || next.id) || String(next.id);
      /* A slug is the public address: two features may not share one. */
      var clash = db.specialFeatures.some(function (x) {
        return String(x.id) !== String(next.id) && String(x.slug) === String(next.slug);
      });
      if (clash) next.slug = next.slug + "-" + String(next.id).slice(-4);
      next.publishAt = next.publishAt || null;
      next.unpublishAt = next.unpublishAt || null;
      next.updatedAt = new Date().toISOString();
      if (i >= 0) db.specialFeatures[i] = next; else db.specialFeatures.push(next);
      normaliseSpecials(db);
      var label = specialLabel(next);
      logActivity((i >= 0 ? "Updated" : "Created") + " special feature " + label, i >= 0 ? "update" : "create");
      Store.logAudit(i >= 0 ? "specialFeature.update" : "specialFeature.create",
        "specialFeature", next.id, "Special feature " + label + (i >= 0 ? " saved" : " created"));
      emit();
      return next.id;
    },
    deleteSpecialFeature: function (id) {
      var f = Store.getSpecialFeature(id); if (!f) return;
      var label = specialLabel(f);
      db.specialFeatures = (db.specialFeatures || []).filter(function (x) { return String(x.id) !== String(id); });
      normaliseSpecials(db);
      logActivity("Deleted special feature " + label, "delete");
      Store.logAudit("specialFeature.delete", "specialFeature", id, "Special feature " + label + " deleted");
      emit();
    },
    setSpecialFeatureEnabled: function (id, on) {
      var f = Store.getSpecialFeature(id); if (!f) return;
      f.enabled = !!on;
      f.updatedAt = new Date().toISOString();
      var label = specialLabel(f);
      logActivity("Special feature " + label + (on ? " enabled" : " disabled"), "status");
      Store.logAudit(on ? "specialFeature.enable" : "specialFeature.disable",
        "specialFeature", id, "Special feature " + label + (on ? " enabled" : " disabled"));
      emit();
    },
    /* delta of -1 or +1 within the candidate list — the curation order, which
       decides which pieces fill the feature's slots and which move up when one
       sells. Features themselves have no order to change. */
    toggleSpecialCandidate: function (id, productId) {
      var f = Store.getSpecialFeature(id); if (!f) return;
      var pid = Number(productId);
      var list = (f.candidateProductIds || []).slice();
      var at = list.indexOf(pid);
      if (at >= 0) list.splice(at, 1);
      else {
        if (list.length >= Store.SPECIAL_CANDIDATE_MAX) return "full";
        list.push(pid);
      }
      Store.saveSpecialFeature({ id: f.id, candidateProductIds: list });
      return at >= 0 ? "removed" : "added";
    },
    moveSpecialCandidate: function (id, productId, delta) {
      var f = Store.getSpecialFeature(id); if (!f) return;
      var list = (f.candidateProductIds || []).slice();
      var i = list.indexOf(Number(productId));
      var j = i + (Number(delta) || 0);
      if (i < 0 || j < 0 || j >= list.length) return;
      list.splice(j, 0, list.splice(i, 1)[0]);
      Store.saveSpecialFeature({ id: f.id, candidateProductIds: list });
    },
    /* media: local/demo only. A row is either a chosen product photograph
       (sourceType "product" — productId + imageId, with imageIndex as the
       fallback reference) or an editorial image of its own (sourceType
       "custom" — src). Product picks store a reference rather than a copied
       URL, so re-photographing a garment updates the feature too. Supabase
       Storage replaces `src` with storage_path; product rows need no change. */
    saveSpecialMedia: function (id, media) {
      var f = Store.getSpecialFeature(id); if (!f) return;
      var rows = (media || []).map(function (m, n) {
        var kind = m.sourceType === "product" ? "product" : "custom";
        return {
          id: m.id || ("sfm-" + Date.now().toString(36) + "-" + n),
          type: m.type || "image",
          slot: Store.SPECIAL_SLOTS.indexOf(m.slot) >= 0 ? m.slot : "primary",
          sourceType: kind,
          src: kind === "custom" ? String(m.src || "").trim() : "",
          productId: m.productId == null || m.productId === "" ? null : Number(m.productId),
          imageId: kind === "product" ? (m.imageId || null) : null,
          imageIndex: kind === "product" && m.imageIndex != null ? Number(m.imageIndex) : null,
          altEn: m.altEn || "", altJa: m.altJa || "",
          sortOrder: n + 1
        };
      }).filter(function (m) {
        return m.sourceType === "product"
          ? (m.productId != null && (m.imageId || m.imageIndex != null))
          : /^https?:\/\/|^\.\/|^uploads\//.test(m.src);
      });
      Store.saveSpecialFeature({ id: f.id, media: rows });
    },

    /* ---- feature visuals ----
       One media row per slot is the human's editorial choice. A slot without a
       row is resolved automatically from the candidate products; a slot with
       one is left exactly as chosen, including when the garment sells. */
    specialVisualFor: function (f, slot) {
      if (!f) return null;
      return (f.media || []).filter(function (m) { return m.slot === slot; })
        .sort(function (a, b) { return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0); })[0] || null;
    },
    /* Turns a media row into something renderable, or reports why it cannot be:
       { src, alt, sourceType, productId, productName, imageIndex, imageCount,
         problem: "" | "missing" | "draft" | "soldout" | "unavailable" }
       `problem` is advisory — the console warns on it; the storefront only
       withholds a visual when there is genuinely no image to show. */
    resolveSpecialVisual: function (m) {
      if (!m) return null;
      if (m.sourceType !== "product") {
        return {
          src: m.src || "", alt: m, sourceType: "custom", productId: null,
          productName: "", imageIndex: null, imageCount: 0,
          problem: m.src ? "" : "unavailable"
        };
      }
      var p = Store.getProduct(m.productId);
      if (!p) {
        return { src: "", alt: m, sourceType: "product", productId: m.productId,
                 productName: "", imageIndex: m.imageIndex, imageCount: 0, problem: "missing" };
      }
      var imgs = p.images || [];
      /* The stable image id is authoritative; the index is the fallback for a
         row written before ids were recorded, or after a picture was removed. */
      var idx = m.imageId ? imgs.findIndex(function (im) { return im.id === m.imageId; }) : -1;
      if (idx < 0 && m.imageIndex != null && imgs[m.imageIndex]) idx = Number(m.imageIndex);
      var im = idx >= 0 ? imgs[idx] : null;
      var problem = !im ? "unavailable" : Store.specialCandidateState(p.id);
      return {
        src: im ? (im.url || im.thumb || "") : "",
        alt: m, sourceType: "product", productId: p.id, productName: p.name,
        imageIndex: idx >= 0 ? idx : null, imageCount: imgs.length,
        problem: problem
      };
    },
    /* Chooses the picture for one slot. Replaces whatever that slot held. */
    setSpecialVisual: function (id, slot, pick) {
      var f = Store.getSpecialFeature(id); if (!f || !pick) return;
      if (Store.SPECIAL_SLOTS.indexOf(slot) < 0) return;
      var rows = (f.media || []).filter(function (m) { return m.slot !== slot; });
      var row = { slot: slot, type: "image" };
      if (pick.sourceType === "custom") {
        row.sourceType = "custom";
        row.src = String(pick.src || "").trim();
        row.altEn = pick.altEn || ""; row.altJa = pick.altJa || "";
      } else {
        var p = Store.getProduct(pick.productId); if (!p) return;
        var imgs = p.images || [];
        var n = Number(pick.imageIndex) || 0;
        if (!imgs[n]) return;
        row.sourceType = "product";
        row.productId = p.id;
        row.imageId = imgs[n].id || null;
        row.imageIndex = n;
        row.altEn = imgs[n].alt || p.name;
        row.altJa = pick.altJa || "";
      }
      Store.saveSpecialMedia(f.id, rows.concat([row]));
      Store.logAudit("specialFeature.visual.update", "specialFeature", f.id,
        "Special feature " + specialLabel(f) + " — " + slot + " visual chosen");
    },
    /* Hands the slot back to automatic resolution. */
    clearSpecialVisual: function (id, slot) {
      var f = Store.getSpecialFeature(id); if (!f) return;
      var rows = (f.media || []).filter(function (m) { return m.slot !== slot; });
      if (rows.length === (f.media || []).length) return;
      Store.saveSpecialMedia(f.id, rows);
      Store.logAudit("specialFeature.visual.reset", "specialFeature", f.id,
        "Special feature " + specialLabel(f) + " — " + slot + " visual returned to automatic");
    },

    /* The three frames, resolved once for both the storefront and the console.
       Per slot: a chosen photograph is used exactly as chosen — a garment
       selling does not rewrite an editorial decision, it only withdraws the
       product card. Only a slot left automatic is filled from the candidates,
       in curated order, skipping missing, unpublished and sold pieces and
       avoiding a picture already used in another frame.

       Returns one entry per slot:
         { slot, mode: "manual"|"auto", img, alt, productId, productName,
           imageIndex, imageCount, problem }
       `img` empty means the frame has nothing to show and the storefront
       should leave it out rather than draw a broken picture. */
    specialFeatureVisuals: function (f) {
      if (!f) return [];
      var manualAlt = function (m, isJa) {
        return (isJa ? (m.altJa || m.altEn) : (m.altEn || m.altJa)) || "";
      };
      var isJa = lang === "ja";
      /* Automatic candidates: eligible products, in the curated order. */
      var pool = Store.specialFeatureProducts(f);
      var usedProduct = {}, usedSrc = {};
      /* A chosen picture is claimed first, so automatic frames do not repeat it. */
      Store.SPECIAL_SLOTS.forEach(function (slot) {
        var m = Store.specialVisualFor(f, slot);
        var r = m ? Store.resolveSpecialVisual(m) : null;
        if (r && r.src) { usedSrc[r.src] = 1; if (r.productId != null) usedProduct[String(r.productId)] = 1; }
      });
      return Store.SPECIAL_SLOTS.map(function (slot) {
        var m = Store.specialVisualFor(f, slot);
        if (m) {
          var r = Store.resolveSpecialVisual(m);
          return {
            slot: slot, mode: "manual",
            img: r.src || "",
            alt: manualAlt(m, isJa) || r.productName || "",
            productId: r.productId, productName: r.productName,
            imageIndex: r.imageIndex, imageCount: r.imageCount,
            problem: r.problem
          };
        }
        var p = pool.find(function (c) { return !usedProduct[String(c.id)]; });
        if (!p) p = pool.find(function (c) {
          var im = (c.images || [])[0] || {};
          return !usedSrc[im.url || im.thumb || ""];
        });
        if (!p) return { slot: slot, mode: "auto", img: "", alt: "", productId: null,
                         productName: "", imageIndex: null, imageCount: 0, problem: "unavailable" };
        usedProduct[String(p.id)] = 1;
        var im2 = (p.images || [])[0] || {};
        var src = im2.url || im2.thumb || "";
        usedSrc[src] = 1;
        return {
          slot: slot, mode: "auto", img: src, alt: im2.alt || p.name,
          productId: p.id, productName: p.name,
          imageIndex: 0, imageCount: (p.images || []).length, problem: ""
        };
      });
    },
    duplicateSpecialFeature: function (id) {
      var f = Store.getSpecialFeature(id); if (!f) return null;
      var now = new Date().toISOString();
      var stamp = Date.now().toString(36);
      var copy = Object.assign({}, JSON.parse(JSON.stringify(f)), {
        id: "sf-" + stamp,
        slug: slugify(f.slug + "-copy-" + stamp),
        titleEn: f.titleEn ? f.titleEn + " (copy)" : "",
        titleJa: f.titleJa ? f.titleJa + "（複写）" : "",
        enabled: false, publishAt: null, unpublishAt: null,
        createdAt: now, updatedAt: now
      });
      copy.media = (copy.media || []).map(function (m, n) {
        return Object.assign({}, m, { id: "sfm-" + stamp + "-" + n });
      });
      db.specialFeatures = (db.specialFeatures || []).concat(copy);
      normaliseSpecials(db);
      logActivity("Duplicated special feature " + specialLabel(f), "create");
      Store.logAudit("specialFeature.duplicate", "specialFeature", copy.id,
        "Special feature " + specialLabel(f) + " duplicated as a draft");
      emit();
      return copy.id;
    },

    /* ---- settings / reset ---- */
    saveSettings: function (s) { db.settings = Object.assign({}, db.settings, s); logActivity("Updated store settings", "update"); emit(); },
    reset: function () {
      db = freshDB();
      Store.logAudit("demo.reset", "database", "v8", "Demo data reset to the seeded v8 schema");
      emit();
    },

    /* ---- auth (prototype only) ---- */
    DEMO: { email: "admin@tsumugi.archive", password: "tsumugi-demo", name: "R. Seo", role: "owner" },
    session: function () {
      try {
        var raw = localStorage.getItem(SESSION) || sessionStorage.getItem(SESSION);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    /* The session record is written by the auth service (tsumugi-auth.js), which
       owns Supabase or the local demo provider; the store only reads it and
       derives the effective role from it. */
    setSession: function (s2, remember) {
      try {
        var target = remember ? localStorage : sessionStorage;
        var other = remember ? sessionStorage : localStorage;
        other.removeItem(SESSION);
        target.setItem(SESSION, JSON.stringify(s2));
      } catch (e) { }
      emit();
      return s2;
    },
    clearSession: function () {
      try { localStorage.removeItem(SESSION); sessionStorage.removeItem(SESSION); } catch (e) { }
      emit();
    },
    /* True for an anonymous (read-only) session. The mode travels with the
       session record, which for Supabase is derived from user.is_anonymous. */
    isGuest: function () {
      var s2 = Store.session();
      return !!s2 && (s2.mode === "anonymous" || s2.role === "guest");
    },
    login: function (email, password, remember) {
      var acc = ACCOUNTS.find(function (a) { return a.email === String(email).trim().toLowerCase(); });
      if (!acc) return { ok: false, field: "email", message: "noAccount" };
      if (password !== acc.password) return { ok: false, field: "password", message: "badPassword" };
      var s2 = { email: acc.email, name: acc.name, role: acc.role, at: new Date().toISOString() };
      try { (remember ? localStorage : sessionStorage).setItem(SESSION, JSON.stringify(s2)); } catch (e) { }
      Store.logAudit("login", "session", acc.role, "Signed in as " + acc.name + " (" + acc.role + ")");
      return { ok: true, session: s2 };
    },
    logout: function () {
      Store.logAudit("logout", "session", Store.roleOf(), "Signed out of the admin console");
      try { localStorage.removeItem(SESSION); sessionStorage.removeItem(SESSION); } catch (e) { }
    },

    /* ---- storefront customer account ----
       Every method here answers for the CURRENT session and takes no user id:
       there is no argument through which one account could ask for another
       account's orders, wishlist, profile or address. In the browser that is a
       correctness boundary rather than a security one — the real one is RLS,
       once these four shapes are Supabase tables (see AUTH_MIGRATION.md). */
    DEMO_CUSTOMER: DEMO_CUSTOMER,
    ANON_WISHLIST: ANON_WISH,

    /* the signed-in customer, or null for staff, guest and public visitors */
    me: function () {
      var s = Store.session();
      if (!s || s.mode === "anonymous") return null;
      if (s.scope ? s.scope !== "customer" : s.role !== "customer") return null;
      var u = Store.authUserById(s.uid);
      return {
        uid: s.uid, email: s.email,
        customerId: (u && u.customerId) || s.customerId || null
      };
    },

    /* ---- accounts (local demo provider backing; tsumugi-auth.js is the caller) ---- */
    authUserByEmail: function (email) {
      var e = String(email || "").trim().toLowerCase();
      return (db.authUsers || []).find(function (u) { return String(u.email).toLowerCase() === e; }) || null;
    },
    authUserById: function (id) {
      return (db.authUsers || []).find(function (u) { return String(u.id) === String(id); }) || null;
    },
    /* Resolves nothing about identity: it only reports whether the credential
       matches. One generic answer, so the caller cannot distinguish “no such
       address” from “wrong password”. */
    customerVerify: function (email, password) {
      var u = Store.authUserByEmail(email);
      if (!u) return Promise.resolve({ ok: false });
      if (u.demo) {
        return Promise.resolve(String(password) === DEMO_CUSTOMER.password ? { ok: true, user: u } : { ok: false });
      }
      if (!u.digest) return Promise.resolve({ ok: false });
      return digest(password, u.salt).then(function (d) {
        return d === u.digest ? { ok: true, user: u } : { ok: false };
      });
    },
    PASSWORD_MIN: 8,
    customerCreate: function (email, password) {
      var e = String(email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return Promise.resolve({ ok: false, code: "invalidEmail" });
      if (String(password || "").length < Store.PASSWORD_MIN) return Promise.resolve({ ok: false, code: "weakPassword" });
      if (Store.authUserByEmail(e)) return Promise.resolve({ ok: false, code: "duplicate" });
      var salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
      return digest(password, salt).then(function (d) {
        var uid = "cus-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
        var now = new Date().toISOString();
        var u = { id: uid, email: e, role: "customer", demo: false, salt: salt, digest: d, customerId: null, createdAt: now };
        db.authUsers = (db.authUsers || []).concat(u);
        db.profiles = (db.profiles || []).concat({
          id: uid, role: "customer", displayName: "", phone: "", customerId: null, createdAt: now
        });
        emit();
        return { ok: true, user: u };
      });
    },
    /* Links an auth user to the customer record its orders live on. Called at
       checkout, with an id the store itself resolved — never from a form. */
    linkAuthUser: function (uid, customerId) {
      var u = Store.authUserById(uid); if (!u) return;
      u.customerId = customerId;
      var p = (db.profiles || []).find(function (x) { return String(x.id) === String(uid); });
      if (p) p.customerId = customerId;
      var c = Store.getCustomer(customerId); if (c) c.authUserId = uid;
      persist();
    },
    /* Admin-side reading of the same link: a customer record either has an
       account behind it or was a guest checkout. */
    customerAccountState: function (customerId) {
      var c = Store.getCustomer(customerId);
      return (c && c.authUserId) ? "registered" : "guest";
    },

    /* ---- profile ---- */
    profileOf: function (uid) {
      return (db.profiles || []).find(function (p) { return String(p.id) === String(uid); }) || null;
    },
    /* The email is the authentication account's, not the profile's: it is shown
       from the session and never written here. */
    myProfile: function () {
      var me = Store.me(); if (!me) return null;
      var p = Store.profileOf(me.uid) || {};
      return {
        uid: me.uid, email: me.email, role: "customer",
        displayName: p.displayName || "", phone: p.phone || "",
        customerId: me.customerId || null
      };
    },
    saveMyProfile: function (patch) {
      var me = Store.me(); if (!me) return null;
      var p = Store.profileOf(me.uid);
      if (!p) { p = { id: me.uid, role: "customer", customerId: me.customerId, createdAt: new Date().toISOString() }; db.profiles = (db.profiles || []).concat(p); }
      if (patch.displayName != null) p.displayName = String(patch.displayName);
      if (patch.phone != null) p.phone = String(patch.phone);
      /* Kept in step with the customer record the shop's staff work from. */
      var c = me.customerId ? Store.getCustomer(me.customerId) : null;
      if (c) {
        if (p.displayName) c.name = p.displayName;
        if (patch.phone != null) c.phone = p.phone;
      }
      emit();
      return Store.myProfile();
    },

    /* ---- shipping address (one, by design) ---- */
    myAddress: function () {
      var me = Store.me(); if (!me) return null;
      var a = (db.addresses || []).find(function (x) { return String(x.userId) === String(me.uid) && x.isDefault !== false; })
        || (db.addresses || []).find(function (x) { return String(x.userId) === String(me.uid); });
      return a ? { postalCode: a.postalCode || "", prefecture: a.prefecture || "", city: a.city || "", address: a.address || "" }
        : { postalCode: "", prefecture: "", city: "", address: "" };
    },
    saveMyAddress: function (patch) {
      var me = Store.me(); if (!me) return null;
      db.addresses = db.addresses || [];
      var a = db.addresses.find(function (x) { return String(x.userId) === String(me.uid); });
      if (!a) { a = { id: "adr-" + me.uid, userId: me.uid, isDefault: true }; db.addresses.push(a); }
      ["postalCode", "prefecture", "city", "address"].forEach(function (k) {
        if (patch[k] != null) a[k] = String(patch[k]);
      });
      emit();
      return Store.myAddress();
    },

    /* ---- wishlist / saved pieces ----
       Rows, not copies: a wishlist holds product ids and nothing else, so a
       price or a photograph is never duplicated out of the catalogue. The
       not-signed-in list is one more owner (“anon”) rather than a special case,
       which is what makes the merge on sign-in a one-liner. */
    wishOwner: function () {
      var me = Store.me();
      return me ? me.uid : ANON_WISH;
    },
    wishlistIds: function () {
      var owner = Store.wishOwner();
      return (db.wishlists || [])
        .filter(function (w) { return String(w.userId) === String(owner); })
        .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })
        .map(function (w) { return w.productId; });
    },
    toggleWishlist: function (productId) {
      var owner = Store.wishOwner();
      db.wishlists = db.wishlists || [];
      var i = db.wishlists.findIndex(function (w) {
        return String(w.userId) === String(owner) && String(w.productId) === String(productId);
      });
      if (i >= 0) db.wishlists.splice(i, 1);
      else db.wishlists.push({ userId: owner, productId: productId, createdAt: new Date().toISOString() });
      emit();
      return i < 0;
    },
    /* Signing in must not cost the visitor the list they just built. Union by
       product id, oldest timestamp kept, anonymous bucket emptied. */
    mergeAnonWishlist: function (uid) {
      if (!uid) return 0;
      db.wishlists = db.wishlists || [];
      var mine = {};
      db.wishlists.forEach(function (w) { if (String(w.userId) === String(uid)) mine[String(w.productId)] = w; });
      var moved = 0;
      db.wishlists.filter(function (w) { return String(w.userId) === ANON_WISH; }).forEach(function (w) {
        var have = mine[String(w.productId)];
        if (have) { if (String(w.createdAt) < String(have.createdAt)) have.createdAt = w.createdAt; }
        else { mine[String(w.productId)] = { userId: uid, productId: w.productId, createdAt: w.createdAt }; moved++; }
      });
      db.wishlists = db.wishlists.filter(function (w) {
        return String(w.userId) !== ANON_WISH && String(w.userId) !== String(uid);
      }).concat(Object.keys(mine).map(function (k) {
        var w = mine[k];
        return { userId: uid, productId: w.productId, createdAt: w.createdAt };
      }));
      emit();
      return moved;
    },

    /* ---- orders, from the customer's side ----
       A projection, not the admin record: internal notes, the status history,
       the audit trail and every staff-facing field are left behind. */
    customerOrderView: function (o) {
      if (!o) return null;
      return {
        number: o.number || o.id,
        date: o.date,
        items: (o.items || []).map(function (it) {
          return { productId: it.productId, name: it.name, brand: it.brand, price: it.price, qty: it.qty || 1, thumb: it.thumb || "" };
        }),
        itemCount: o.itemCount != null ? o.itemCount : (o.items || []).length,
        subtotal: o.subtotal, shippingFee: o.shippingFee, total: o.total,
        paymentStatus: o.paymentStatus, fulfilmentStatus: o.fulfilmentStatus,
        deliveryMethod: o.deliveryMethod, paymentMethod: o.paymentMethod,
        tracking: o.tracking || "",
        shipping: Object.assign({}, o.shipping || {}),
        email: o.email || ""
      };
    },
    _ownsOrder: function (me, o) {
      if (!me || !o) return false;
      if (o.userId) return String(o.userId) === String(me.uid);
      return !!me.customerId && String(o.customerId) === String(me.customerId);
    },
    myOrders: function () {
      var me = Store.me(); if (!me) return [];
      return (db.orders || [])
        .filter(function (o) { return Store._ownsOrder(me, o); })
        .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })
        .map(Store.customerOrderView);
    },
    /* Ownership is checked here, so a hand-typed order id in the address bar
       returns nothing rather than someone else's order. */
    myOrder: function (id) {
      var me = Store.me(); if (!me) return null;
      var o = (db.orders || []).find(function (x) { return String(x.id) === String(id); });
      if (!o || !Store._ownsOrder(me, o)) return null;
      return Store.customerOrderView(o);
    },

    /* ---- ui bus ---- */
    toast: function (message, kind) { emitUI({ ui: "toast", message: message, kind: kind || "success" }); },
    confirm: function (opts) {
      return new Promise(function (resolve) { emitUI({ ui: "confirm", opts: opts, resolve: resolve }); });
    },
  };

  window.addEventListener("storage", function (e) {
    /* Once Supabase is authoritative, a stale demo snapshot in another tab
       must never replace the server catalogue. Browser storage remains only
       for local-demo mode and device-local preferences. */
    if (Store._remoteEnabled) return;
    if (e.key === KEY) { db = load(); listeners.slice().forEach(function (fn) { try { fn(db); } catch (err) { } }); }
  });

  /* ---- store-level permission enforcement ----

     Two API groups, one gate.

       PUBLIC_API  the storefront's own operations, available to any visitor:
                   placeOrder and its bookkeeping, the wishlist, the newsletter
                   and contact intents, customer account operations. Each
                   validates its own input, and none of them can read or write
                   another person's data.

       GUARDED     the admin API. Requires a STAFF session and the named
                   permission. A signed-out visitor, a storefront customer and
                   the anonymous demo guest are all refused.

     The previous build passed a signed-out caller straight through to the
     mutation ("not an administrator being denied — just the storefront"), which
     left every admin write reachable with no session at all. No session is now
     the strictest case, not the most permissive. */
  var PUBLIC_API = [
    "placeOrder", "_validateAndCommit", "_commitOrder", "receiptOrder", "_issueReceiptToken",
    "toggleWishlist", "wishlistOf", "mergeAnonWishlist",
    "customerCreate", "customerVerify", "saveOwnProfile", "saveOwnAddress",
    "subscribeNewsletter", "submitContact", "login", "logout"
  ];
  var GUARDED = {
    saveProduct: "products.edit", setProductStatus: "products.publish",
    setProductCategory: "products.edit", duplicateProduct: "products.edit",
    deleteProducts: "products.delete",
    saveCustomer: "customers.edit", setCustomerStatus: "customers.edit",
    tagCustomers: "customers.edit", deleteCustomers: "customers.delete",
    addNote: "customers.edit", updateNote: "customers.edit", deleteNote: "customers.edit",
    customerCSV: "export", orderCSV: "export",
    saveNews: "content.edit", setNewsStatus: "content.publish",
    duplicateNews: "content.edit", deleteNews: "content.edit",
    setOrderPayment: "orders.edit", setOrderFulfilment: "orders.edit",
    setOrderTracking: "orders.edit", addOrderNote: "orders.edit",
    /* placeOrder and its bookkeeping (orderHistory, syncCustomerPurchase) stay
       ungated on purpose: they are the public storefront's own checkout, which
       any visitor may complete — including one holding a read-only guest
       session. Everything an administrator does to an existing order is gated
       above. */
    saveHeroFeature: "content.edit", deleteHeroFeature: "content.edit",
    setHeroFeatureEnabled: "content.edit", reorderHeroFeatures: "content.edit",
    /* Special features reuse the content permissions: an editor curates them,
       a viewer or the anonymous guest may only read them. */
    saveSpecialFeature: "content.edit", deleteSpecialFeature: "content.edit",
    setSpecialFeatureEnabled: "content.publish",
    toggleSpecialCandidate: "content.edit", moveSpecialCandidate: "content.edit",
    saveSpecialMedia: "content.edit", duplicateSpecialFeature: "content.edit",
    setSpecialVisual: "content.edit", clearSpecialVisual: "content.edit",
    saveSettings: "settings", reset: "reset", setRole: "roles"
  };
  Store.lastPersistError = function () { return lastPersistError; };
  Store.PUBLIC_API = PUBLIC_API.slice();
  Store.ADMIN_API = Object.keys(GUARDED);

  Object.keys(GUARDED).forEach(function (name) {
    var perm = GUARDED[name], inner = Store[name];
    if (typeof inner !== "function") return;
    Store[name] = function () {
      var arguments2 = arguments;
      var s = Store.session();
      var deny = function (why, loud) {
        try {
          Store.logAudit("permission.denied", "action", name,
            "Blocked " + name + " — " + why + " (needs " + perm + ")");
        } catch (e) { }
        if (loud) {
          var msg = "You do not have permission to do that";
          try { msg = window.TSUMUGI_I18N.t(lang).permissionDenied || msg; } catch (e2) { }
          Store.toast(msg, "error");
        } else {
          try { console.warn("TSUMUGI: refused " + name + " — " + why); } catch (e3) { }
        }
        return null;
      };
      /* No session at all: refuse quietly. There is no console open to toast,
         and a boot-time call must not paint an error over the storefront. */
      if (!s) return deny("no session", false);
      if (!Store.isStaffSession()) return deny("session is not staff (role “" + Store.roleOf() + "”)", true);
      if (!Store.can(perm)) return deny("role “" + Store.roleOf() + "” lacks " + perm, true);
      /* Mutate inside a transaction: if the write to localStorage fails (quota
         is the usual cause), the change is rolled back and the operator is
         told. Silently keeping an unsaved edit in memory is how the previous
         build reported saves that the next reload contradicted. */
      var t = transact(function () { return inner.apply(Store, arguments2); });
      if (!t.ok) {
        var qmsg = t.code === "quota"
          ? (lang === "ja"
              ? "ブラウザの保存容量が上限に達しました。変更は保存されていません。画像を整理してください。"
              : "This browser's storage is full. The change was NOT saved — remove some images and try again.")
          : (lang === "ja" ? "変更を保存できませんでした。" : "The change could not be saved.");
        Store.toast(qmsg, "error");
        return null;
      }
      return t.value;
    };
  });

  /* ---------- production CMS bridge ----------

     The React views deliberately keep their synchronous read API
     (`products()`, `news()`, feature selectors).  Supabase is asynchronous, so
     tsumugi-repository.js loads rows into this in-memory projection and updates
     it only after a server write succeeds.  Nothing here writes the remote
     catalogue back to localStorage: the database is the sole source of truth.

     These underscored methods are an internal bridge, not an admin API.  They
     contain no authorization decision; every remote read/write is still
     checked by Postgres grants + RLS. */
  Store._remoteEnabled = false;
  Store._remoteStatus = "local";
  Store._setRemoteStatus = function (status) {
    Store._remoteEnabled = status !== "local";
    Store._remoteStatus = status;
    listeners.slice().forEach(function (fn) { try { fn(db); } catch (e) { } });
  };
  Store.cmsStatus = function () { return Store._remoteStatus; };
  Store._applyRemoteCMS = function (snapshot) {
    snapshot = snapshot || {};
    if (Array.isArray(snapshot.products)) db.products = snapshot.products;
    if (Array.isArray(snapshot.news)) db.news = snapshot.news;
    if (Array.isArray(snapshot.heroFeatures)) db.heroFeatures = snapshot.heroFeatures;
    if (Array.isArray(snapshot.specialFeatures)) db.specialFeatures = snapshot.specialFeatures;
    /* The remote phase currently implements editorial CMS only. Never mix the
       bundled fictional customers/orders/accounts into a console that is
       displaying real Supabase content: zero is truthful, demo totals are not.
       A future commerce phase must hydrate these from their own RLS-safe
       repositories before those screens are enabled. */
    db.customers = [];
    db.orders = [];
    db.authUsers = [];
    db.profiles = [];
    db.addresses = [];
    db.wishlists = [];
    db.activity = [];
    db.audit = [];
    normaliseHero(db);
    normaliseSpecials(db);
    Store._remoteEnabled = true;
    Store._remoteStatus = "ready";
    listeners.slice().forEach(function (fn) { try { fn(db); } catch (e) { } });
  };

  try { document.documentElement.lang = lang; } catch (e) { }

  window.TSUMUGI_STORE = Store;
})();
