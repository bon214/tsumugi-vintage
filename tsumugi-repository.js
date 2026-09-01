/* TSUMUGI · Supabase-backed CMS repository.

   The existing screens keep TSUMUGI_STORE as a synchronous, observable view
   model.  This adapter makes Postgres authoritative when auth-config.js is
   filled: reads hydrate that view model; writes update it only after Supabase
   confirms success.  With an empty config the original offline demo is left
   completely untouched. */
(function () {
  "use strict";
  if (window.TSUMUGI_CMS) return;

  var CFG = window.TSUMUGI_AUTH_CONFIG || {};
  var configured = !!(CFG.url && CFG.anonKey && window.TSUMUGI_SUPABASE_CLIENT);
  var readyPromise = null;
  var refreshPromise = null;
  var refreshScope = "";
  var authAttached = false;
  var lastScope = "";
  var rebuildTimer = null;
  /* cost_price and supplier are deliberately absent: Postgres does not grant
     those commercial columns to browser roles, so select("*") would both ask
     for too much and make the entire public query fail. */
  var PRODUCT_SELECT = [
    "id", "sku", "slug", "name", "brand", "year", "year_label", "price", "tax_status",
    "category", "subcategory", "size", "size_notation", "colour", "material", "country",
    "era", "condition", "condition_note", "stains", "damage", "repairs", "fading",
    "missing_parts", "curator_note", "story", "styling", "collection", "measurements",
    "images", "stock", "status", "featured", "meta_title", "meta_description",
    "publish_date", "created_at", "updated_at"
  ].join(",");

  function store() { return window.TSUMUGI_STORE; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function val(value, fallback) { return value == null ? fallback : value; }
  function fail(result) {
    if (result && result.error) throw result.error;
    return result ? result.data : null;
  }

  function productFromRow(r) {
    return {
      id: r.id, sku: r.sku || "", slug: r.slug || "",
      name: r.name || "", brand: r.brand || "",
      year: Number(val(r.year, String(r.year_label || "").replace(/[^0-9]/g, ""))) || 0,
      price: Number(r.price) || 0, taxStatus: r.tax_status || "Tax included",
      category: r.category || "", subcategory: r.subcategory || "",
      size: r.size || "", sizeNotation: r.size_notation || "",
      colour: r.colour || "", material: r.material || "", country: r.country || "",
      era: r.era || "", condition: r.condition || "",
      conditionNote: r.condition_note || "", stains: r.stains || "",
      damage: r.damage || "", repairs: r.repairs || "", fading: r.fading || "",
      missingParts: r.missing_parts || "", curatorNote: r.curator_note || "",
      story: r.story || "", styling: r.styling || "", collection: r.collection || "",
      measurements: r.measurements || {}, images: Array.isArray(r.images) ? r.images : [],
      stock: Number(r.stock) || 0, status: r.status || "draft",
      featured: !!r.featured, metaTitle: r.meta_title || "",
      metaDescription: r.meta_description || "", publishDate: r.publish_date || "",
      createdAt: r.created_at || null, updatedAt: r.updated_at || null
    };
  }

  function productToRow(p) {
    return {
      sku: String(p.sku || "").trim() || null,
      slug: String(p.slug || "").trim() || null,
      name: String(p.name || "").trim(), brand: String(p.brand || "").trim() || null,
      year: Number(p.year) || null, year_label: p.year ? String(p.year) : null,
      price: Math.max(0, Number(p.price) || 0), tax_status: p.taxStatus || null,
      category: p.category || null, subcategory: p.subcategory || null,
      size: p.size || null, size_notation: p.sizeNotation || null,
      colour: p.colour || null, material: p.material || null,
      country: p.country || null, era: p.era || null, condition: p.condition || null,
      condition_note: p.conditionNote || null, stains: p.stains || null,
      damage: p.damage || null, repairs: p.repairs || null, fading: p.fading || null,
      missing_parts: p.missingParts || null, curator_note: p.curatorNote || null,
      story: p.story || null, styling: p.styling || null, collection: p.collection || null,
      measurements: p.measurements || {}, images: Array.isArray(p.images) ? p.images : [],
      stock: Math.max(0, Number(p.stock) || 0), status: p.status || "draft",
      featured: !!p.featured, meta_title: p.metaTitle || null,
      meta_description: p.metaDescription || null, publish_date: p.publishDate || null
    };
  }

  function newsFromRow(r) {
    return {
      id: r.id, type: r.type || "journal", title: r.title || "", slug: r.slug || "",
      summary: r.summary || "", image: r.image || "", thumb: r.thumb || r.image || "",
      alt: r.alt || "", body: r.body || "", author: r.author || "TSUMUGI Studio",
      category: r.category || "", tags: Array.isArray(r.tags) ? r.tags : [],
      relatedProducts: Array.isArray(r.related_product_ids) ? r.related_product_ids : [],
      seoTitle: r.seo_title || "", seoDescription: r.seo_description || "",
      status: r.status || "draft", publishDate: r.publish_date || "",
      updatedAt: r.updated_at || null, createdAt: r.created_at || null,
      featured: !!r.featured
    };
  }

  function newsToRow(n) {
    var sanitise = window.TSUMUGI_SAN && window.TSUMUGI_SAN.html;
    return {
      type: n.type === "news" ? "news" : "journal",
      title: String(n.title || "").trim(), slug: String(n.slug || "").trim(),
      category: n.category || null, summary: n.summary || null,
      body: sanitise ? sanitise(n.body || "") : String(n.body || ""),
      image: n.image || null, thumb: n.thumb || n.image || null, alt: n.alt || null,
      author: n.author || null, tags: Array.isArray(n.tags) ? n.tags : [],
      related_product_ids: (n.relatedProducts || []).map(Number).filter(Number.isFinite),
      status: n.status || "draft", publish_date: n.publishDate || null,
      seo_title: n.seoTitle || null, seo_description: n.seoDescription || null,
      featured: !!n.featured
    };
  }

  function heroFromRow(r) {
    return {
      id: r.id, sourceType: r.source_type, sourceId: r.source_id,
      route: r.route || "", enabled: !!r.enabled, order: Number(r.sort_order) || 1,
      createdAt: r.created_at || null, updatedAt: r.updated_at || null
    };
  }
  function heroToRow(f) {
    return {
      id: String(f.id), source_type: f.sourceType || "page",
      source_id: f.sourceType === "page" ? null : (f.sourceId == null ? null : Number(f.sourceId)),
      route: f.sourceType === "page" ? (f.route || null) : null,
      enabled: !!f.enabled, sort_order: Math.max(1, Number(f.order) || 1)
    };
  }

  function specialFromRow(r) {
    return {
      id: r.id, slug: r.slug || "", titleEn: r.title_en || "", titleJa: r.title_ja || "",
      descriptionEn: r.description_en || "", descriptionJa: r.description_ja || "",
      category: r.category || "", eraLabel: r.era_label || "", enabled: !!r.enabled,
      publishAt: r.publish_at || null, unpublishAt: r.unpublish_at || null,
      candidateProductIds: Array.isArray(r.candidate_product_ids) ? r.candidate_product_ids.map(Number) : [],
      media: Array.isArray(r.media) ? r.media : [],
      createdAt: r.created_at || null, updatedAt: r.updated_at || null
    };
  }
  function specialToRow(f) {
    return {
      id: String(f.id), slug: String(f.slug || f.id),
      title_en: f.titleEn || "", title_ja: f.titleJa || "",
      description_en: f.descriptionEn || "", description_ja: f.descriptionJa || "",
      category: f.category || null, era_label: f.eraLabel || null,
      enabled: !!f.enabled, publish_at: f.publishAt || null, unpublish_at: f.unpublishAt || null,
      candidate_product_ids: (f.candidateProductIds || []).map(Number).filter(Number.isFinite).slice(0, 8),
      media: Array.isArray(f.media) ? f.media.slice(0, 6) : []
    };
  }

  function isStaff() {
    var s = store();
    return !!(s && s.isStaffSession && s.isStaffSession());
  }
  function scope() { return isStaff() ? "staff" : "public"; }

  function querySnapshot(client, wantedScope) {
    var specialTable = wantedScope === "staff" ? "special_features" : "public_special_features";
    return Promise.all([
      client.from("products").select(PRODUCT_SELECT).order("created_at", { ascending: false }),
      client.from("news").select("*").order("publish_date", { ascending: false, nullsFirst: false }),
      client.from("hero_features").select("*").order("sort_order", { ascending: true }),
      client.from(specialTable).select("*").order("publish_at", { ascending: false, nullsFirst: false })
    ]).then(function (rows) {
      return {
        products: (fail(rows[0]) || []).map(productFromRow),
        news: (fail(rows[1]) || []).map(newsFromRow),
        heroFeatures: (fail(rows[2]) || []).map(heroFromRow),
        specialFeatures: (fail(rows[3]) || []).map(specialFromRow)
      };
    });
  }

  function refresh(forceScope) {
    if (!configured) return Promise.resolve(null);
    var wantedScope = forceScope || scope();
    if (refreshPromise) {
      if (wantedScope === refreshScope) return refreshPromise;
      return refreshPromise.catch(function () { }).then(function () { return refresh(wantedScope); });
    }
    refreshScope = wantedScope;
    var s = store();
    if (s && s._setRemoteStatus) s._setRemoteStatus("loading");
    refreshPromise = window.TSUMUGI_SUPABASE_CLIENT()
      .then(function (client) { return querySnapshot(client, wantedScope); })
      .then(function (snapshot) {
        var current = store();
        if (!current || !current._applyRemoteCMS) throw new Error("TSUMUGI_STORE bridge is unavailable");
        current._applyRemoteCMS(snapshot);
        lastScope = wantedScope;
        return snapshot;
      })
      .catch(function (error) {
        var current = store();
        if (current && current._setRemoteStatus) current._setRemoteStatus("error");
        try { console.error("TSUMUGI CMS: catalogue load failed", error); } catch (e) { }
        throw error;
      })
      .finally(function () { refreshPromise = null; refreshScope = ""; });
    return refreshPromise;
  }

  function genericError() {
    var s = store();
    var ja = s && s.lang && s.lang() === "ja";
    return ja
      ? "Supabaseへの保存に失敗しました。通信状態を確認して、もう一度お試しください。"
      : "Supabase could not save the change. Check the connection and try again.";
  }
  function permissionError() {
    var s = store();
    var ja = s && s.lang && s.lang() === "ja";
    return ja ? "この操作を行う権限がありません。" : "You do not have permission to do that.";
  }
  function allow(permission) {
    var s = store();
    if (s && s.isStaffSession && s.isStaffSession() && s.can && s.can(permission)) return true;
    if (s && s.toast) s.toast(permissionError(), "error");
    return false;
  }

  function scheduleRebuild(reason) {
    var fn = CFG.functions && CFG.functions.rebuild;
    if (!fn) return;
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(function () {
      window.TSUMUGI_SUPABASE_CLIENT().then(function (client) {
        return client.functions.invoke(fn, { body: { reason: reason || "content_changed" } });
      }).then(function (result) {
        if (result && result.error) throw result.error;
      }).catch(function () {
        var s = store();
        if (s && s.toast) s.toast(
          s.lang && s.lang() === "ja"
            ? "内容は保存されましたが、SEOページの再生成を開始できませんでした。"
            : "The content was saved, but the SEO rebuild could not be started.",
          "warning"
        );
      });
    }, 1200);
  }

  function mutation(permission, work, opts) {
    if (!allow(permission)) return Promise.resolve(null);
    return window.TSUMUGI_SUPABASE_CLIENT().then(work).then(function (value) {
      return refresh("staff").then(function () {
        if (opts && opts.rebuild) scheduleRebuild(opts.reason);
        return value;
      });
    }).catch(function (error) {
      try { console.error("TSUMUGI CMS: write failed", error); } catch (e) { }
      var s = store();
      if (s && s.toast) s.toast(genericError(), "error");
      return null;
    });
  }

  function installWrites() {
    var s = store();
    if (!configured || !s || s._cmsWritesInstalled) return;
    s._cmsWritesInstalled = true;

    /* The hosted phase covered by this repository is a portfolio CMS, not a
       live checkout. Never fall through to the localStorage prototype with a
       visitor's address when Supabase is configured. A future payment release
       must replace this with an awaited create-order Edge Function client and
       its own end-to-end tests. */
    s.placeOrder = function () { return { ok: false, code: "portfolio_only" }; };

    s.saveProduct = function (product) {
      var row = productToRow(product);
      return mutation("products.edit", function (client) {
        var q = product.id
          ? client.from("products").update(row).eq("id", product.id)
          : client.from("products").insert(row);
        return q.select("id").single().then(function (r) { return fail(r).id; });
      }, { rebuild: row.status === "published" || row.status === "soldout", reason: "product_saved" });
    };
    s.setProductStatus = function (ids, status) {
      ids = [].concat(ids).map(Number);
      return mutation("products.publish", function (client) {
        var patch = { status: status };
        if (status === "soldout") patch.stock = 0;
        return client.from("products").update(patch)
          .in("id", ids).select("id").then(function (r) { fail(r); return ids; });
      }, { rebuild: true, reason: "product_status" });
    };
    s.setProductCategory = function (ids, category) {
      ids = [].concat(ids).map(Number);
      return mutation("products.edit", function (client) {
        return client.from("products").update({ category: category }).in("id", ids)
          .select("id").then(function (r) { fail(r); return ids; });
      }, { rebuild: true, reason: "product_category" });
    };
    s.duplicateProduct = function (id) {
      var source = s.getProduct(id); if (!source) return Promise.resolve(null);
      var copy = clone(source);
      delete copy.id;
      copy.name += " (copy)";
      copy.sku += "-COPY-" + Date.now().toString(36).slice(-5);
      copy.slug += "-copy-" + Date.now().toString(36).slice(-5);
      copy.status = "draft"; copy.featured = false;
      return s.saveProduct(copy);
    };
    s.deleteProducts = function (ids) {
      ids = [].concat(ids).map(Number);
      return mutation("products.delete", function (client) {
        return client.from("products").delete().in("id", ids)
          .select("id").then(function (r) { fail(r); return ids; });
      }, { rebuild: true, reason: "product_deleted" });
    };

    s.saveNews = function (entry) {
      var row = newsToRow(entry);
      return mutation("content.edit", function (client) {
        var q = entry.id
          ? client.from("news").update(row).eq("id", entry.id)
          : client.from("news").insert(row);
        return q.select("id").single().then(function (r) { return fail(r).id; });
      }, { rebuild: row.status === "published" || row.status === "scheduled", reason: "article_saved" });
    };
    s.setNewsStatus = function (ids, status) {
      ids = [].concat(ids).map(Number);
      return mutation("content.publish", function (client) {
        return client.from("news").update({ status: status }).in("id", ids)
          .select("id").then(function (r) { fail(r); return ids; });
      }, { rebuild: true, reason: "article_status" });
    };
    s.duplicateNews = function (id) {
      var source = s.getNews(id); if (!source) return Promise.resolve(null);
      var copy = clone(source);
      delete copy.id;
      copy.title += " (copy)";
      copy.slug += "-copy-" + Date.now().toString(36).slice(-5);
      copy.status = "draft"; copy.featured = false;
      return s.saveNews(copy);
    };
    s.deleteNews = function (ids) {
      ids = [].concat(ids).map(Number);
      return mutation("content.edit", function (client) {
        return client.from("news").delete().in("id", ids)
          .select("id").then(function (r) { fail(r); return ids; });
      }, { rebuild: true, reason: "article_deleted" });
    };

    s.saveHeroFeature = function (feature) {
      var persisted = feature && feature.id ? s.getHeroFeature(feature.id) : null;
      var existing = persisted || s.blankHeroFeature();
      var next = Object.assign({}, existing, feature);
      if (next.sourceType === "page") next.sourceId = null; else next.route = "";
      if (s.heroSourceState(next) === "unset") next.enabled = false;
      if (!persisted && s.heroFeatures().length >= s.HERO_MAX) return Promise.resolve(null);
      var row = heroToRow(next);
      return mutation("content.edit", function (client) {
        return client.from("hero_features").upsert(row, { onConflict: "id" })
          .select("id").single().then(function (r) { return fail(r).id; });
      }, { rebuild: true, reason: "hero_saved" });
    };
    s.deleteHeroFeature = function (id) {
      return mutation("content.edit", function (client) {
        return client.from("hero_features").delete().eq("id", id)
          .select("id").then(function (r) { fail(r); return id; });
      }, { rebuild: true, reason: "hero_deleted" });
    };
    s.setHeroFeatureEnabled = function (id, enabled) {
      var f = s.getHeroFeature(id); if (!f) return Promise.resolve(null);
      return s.saveHeroFeature(Object.assign({}, f, { enabled: !!enabled }));
    };
    s.reorderHeroFeatures = function (id, delta) {
      var list = s.heroFeatures();
      var i = list.findIndex(function (f) { return String(f.id) === String(id); });
      var j = i + (Number(delta) || 0);
      if (i < 0 || j < 0 || j >= list.length) return Promise.resolve(null);
      list.splice(j, 0, list.splice(i, 1)[0]);
      return mutation("content.edit", function (client) {
        return client.rpc("reorder_hero_features", { feature_ids: list.map(function (f) { return f.id; }) })
          .then(function (r) { fail(r); return id; });
      }, { rebuild: true, reason: "hero_reordered" });
    };

    s.saveSpecialFeature = function (feature) {
      var existing = s.getSpecialFeature(feature.id) || s.blankSpecialFeature();
      var next = Object.assign({}, existing, feature);
      var row = specialToRow(next);
      return mutation("content.edit", function (client) {
        return client.from("special_features").upsert(row, { onConflict: "id" })
          .select("id").single().then(function (r) { return fail(r).id; });
      }, { rebuild: true, reason: "special_saved" });
    };
    s.deleteSpecialFeature = function (id) {
      return mutation("content.edit", function (client) {
        return client.from("special_features").delete().eq("id", id)
          .select("id").then(function (r) { fail(r); return id; });
      }, { rebuild: true, reason: "special_deleted" });
    };
    s.setSpecialFeatureEnabled = function (id, enabled) {
      if (!allow("content.publish")) return Promise.resolve(null);
      var f = s.getSpecialFeature(id); if (!f) return Promise.resolve(null);
      return s.saveSpecialFeature(Object.assign({}, f, { enabled: !!enabled }));
    };
    s.duplicateSpecialFeature = function (id) {
      var f = s.getSpecialFeature(id); if (!f) return Promise.resolve(null);
      var copy = clone(f);
      copy.id = "sf-" + Date.now().toString(36);
      copy.slug = (copy.slug || "feature") + "-copy-" + Date.now().toString(36).slice(-5);
      copy.titleEn = (copy.titleEn || "Untitled feature") + " (copy)";
      copy.titleJa = (copy.titleJa || "無題の特集") + "（複製）";
      copy.enabled = false; copy.publishAt = null; copy.unpublishAt = null;
      return s.saveSpecialFeature(copy);
    };
    s.toggleSpecialCandidate = function (id, productId) {
      var f = s.getSpecialFeature(id); if (!f) return Promise.resolve(null);
      var pid = Number(productId), list = (f.candidateProductIds || []).slice();
      var at = list.indexOf(pid), result;
      if (at >= 0) { list.splice(at, 1); result = "removed"; }
      else {
        if (list.length >= s.SPECIAL_CANDIDATE_MAX) return Promise.resolve("full");
        list.push(pid); result = "added";
      }
      return s.saveSpecialFeature({ id: f.id, candidateProductIds: list })
        .then(function (saved) { return saved ? result : null; });
    };
    s.moveSpecialCandidate = function (id, productId, delta) {
      var f = s.getSpecialFeature(id); if (!f) return Promise.resolve(null);
      var list = (f.candidateProductIds || []).slice();
      var i = list.indexOf(Number(productId)), j = i + (Number(delta) || 0);
      if (i < 0 || j < 0 || j >= list.length) return Promise.resolve(null);
      list.splice(j, 0, list.splice(i, 1)[0]);
      return s.saveSpecialFeature({ id: f.id, candidateProductIds: list });
    };
    s.saveSpecialMedia = function (id, media) {
      var f = s.getSpecialFeature(id); if (!f) return Promise.resolve(null);
      return s.saveSpecialFeature({ id: f.id, media: (media || []).slice(0, 6) });
    };
    s.setSpecialVisual = function (id, slot, pick) {
      var f = s.getSpecialFeature(id); if (!f || !pick) return Promise.resolve(null);
      var rows = (f.media || []).filter(function (m) { return m.slot !== slot; });
      var row = { id: "sfm-" + Date.now().toString(36), slot: slot, type: "image", sortOrder: rows.length + 1 };
      if (pick.sourceType === "custom") {
        row.sourceType = "custom"; row.src = String(pick.src || "").trim();
        row.altEn = pick.altEn || ""; row.altJa = pick.altJa || "";
      } else {
        var p = s.getProduct(pick.productId), index = Number(pick.imageIndex) || 0;
        var image = p && (p.images || [])[index];
        if (!image) return Promise.resolve(null);
        row.sourceType = "product"; row.productId = p.id; row.imageId = image.id || null;
        row.imageIndex = index; row.altEn = image.alt || p.name; row.altJa = pick.altJa || "";
      }
      return s.saveSpecialMedia(id, rows.concat([row]));
    };
    s.clearSpecialVisual = function (id, slot) {
      var f = s.getSpecialFeature(id); if (!f) return Promise.resolve(null);
      return s.saveSpecialMedia(id, (f.media || []).filter(function (m) { return m.slot !== slot; }));
    };
  }

  function attachAuth() {
    if (!configured || authAttached) return;
    var auth = window.TSUMUGI_AUTH;
    if (!auth || !auth.subscribe) { setTimeout(attachAuth, 50); return; }
    authAttached = true;
    auth.subscribe(function () {
      var wanted = scope();
      if (wanted !== lastScope) refresh(wanted).catch(function () { });
    });
  }

  /* Authentication must own the first use of the shared Supabase client.

     A PKCE recovery callback is consumed while the client initializes.  This
     repository is loaded before tsumugi-auth.js and historically called
     ready() immediately, so its catalogue query created the shared client
     before Auth had subscribed to onAuthStateChange.  Supabase successfully
     exchanged the one-time code, but PASSWORD_RECOVERY had no listener and
     the storefront stayed on Home.  Waiting for Auth.boot() here preserves
     that one-shot event and also makes an existing staff session available
     before the repository chooses its public/staff query scope. */
  function waitForAuthBoot() {
    return new Promise(function (resolve, reject) {
      var attempts = 0;
      (function wait() {
        var auth = window.TSUMUGI_AUTH;
        if (auth && typeof auth.boot === "function") {
          Promise.resolve(auth.boot()).then(resolve, reject);
          return;
        }
        attempts++;
        if (attempts >= 200) {
          reject(new Error("TSUMUGI Auth did not load before the CMS timeout"));
          return;
        }
        setTimeout(wait, 25);
      })();
    });
  }

  function ready() {
    if (!configured) return Promise.resolve({ mode: "local" });
    installWrites();
    attachAuth();
    if (!readyPromise) {
      readyPromise = waitForAuthBoot()
        .then(function () { return refresh(); })
        .then(function () { return { mode: "supabase" }; });
    }
    return readyPromise;
  }

  window.TSUMUGI_CMS = {
    configured: function () { return configured; },
    ready: ready,
    refresh: refresh,
    productFromRow: productFromRow,
    productToRow: productToRow,
    newsFromRow: newsFromRow,
    newsToRow: newsToRow,
    requestRebuild: scheduleRebuild
  };

  if (configured) ready().catch(function () { });
})();
