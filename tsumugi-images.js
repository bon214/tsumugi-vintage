/* TSUMUGI — image intake.

   One place where an uploaded file is validated, measured and turned into
   something the app can store. Two providers behind one interface:

     local     data URL in localStorage. The portfolio demo. Strictly bounded,
               because localStorage is a few megabytes shared with the entire
               dataset — one 4 MB photograph can make the whole store
               unsaveable, and the previous build discovered that by silently
               losing the operator's work.

     supabase  upload to Storage, keep the returned path. Same validation, same
               limits; the bytes leave the browser instead of filling it.

   What was wrong before:
     · accept="image/*" was the only check — a renamed .exe passed.
     · the success toast fired synchronously, before FileReader had finished, so
       a failed or oversized read still said "image(s) added".
     · persist() swallowed a quota error, so the console reported a save that
       had not happened and the next reload showed the old data.

   Exposes window.TSUMUGI_IMAGES. */
(function () {
  "use strict";
  if (window.TSUMUGI_IMAGES) return;

  /* This classic script is always served from the deployment root. Capturing
     its URL here gives components a GitHub-Pages-subpath-safe base even when
     the current document is /about/ or /p/<id>/. */
  var ASSET_BASE = (function () {
    try {
      var src = document.currentScript && document.currentScript.src;
      return src ? new URL("./", src).href : new URL("./", location.href).href;
    } catch (e) { return "./"; }
  })();

  var RULES = {
    /* Extension and MIME must BOTH be in the allowlist, and must agree. A file
       called photo.png whose bytes say image/svg+xml is rejected: SVG is a
       script container, so it is not an accepted image type here at all. */
    mime: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    ext: ["jpg", "jpeg", "png", "webp", "avif"],
    maxBytesPerFile: 3 * 1024 * 1024,       /* 3 MB */
    maxFilesPerBatch: 8,
    /* Total budget for locally-stored images. A data URL is ~4/3 the size of the
       file, and localStorage caps out around 5 MB in most browsers, so the local
       provider stays well under it. */
    maxLocalTotalBytes: 2 * 1024 * 1024,
    /* Magic numbers, checked against the first bytes of the file. The extension
       and the Content-Type header are both attacker-supplied; these are not. */
    signatures: [
      { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
      { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
      { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], at8: [0x57, 0x45, 0x42, 0x50] },
      { mime: "image/avif", ftyp: true }
    ]
  };

  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(String(name || ""));
    return m ? m[1].toLowerCase() : "";
  }

  function readHead(file, n) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onerror = function () { reject(new Error("read_failed")); };
      r.onload = function () { resolve(new Uint8Array(r.result)); };
      r.readAsArrayBuffer(file.slice(0, n));
    });
  }

  function matchSignature(head) {
    for (var i = 0; i < RULES.signatures.length; i++) {
      var s = RULES.signatures[i];
      if (s.ftyp) {
        /* AVIF/HEIF: 'ftyp' at offset 4, brand at 8. */
        if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
          var brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
          if (/avif|avis|mif1|msf1/i.test(brand)) return "image/avif";
        }
        continue;
      }
      var ok = true;
      for (var b = 0; b < s.bytes.length; b++) { if (head[b] !== s.bytes[b]) { ok = false; break; } }
      if (ok && s.at8) {
        for (var c = 0; c < s.at8.length; c++) { if (head[8 + c] !== s.at8[c]) { ok = false; break; } }
      }
      if (ok) return s.mime;
    }
    return null;
  }

  /* Resolves { ok, code } — never throws, so a caller can report every file. */
  function validate(file) {
    if (!file) return Promise.resolve({ ok: false, code: "no_file" });
    var ext = extOf(file.name);
    if (RULES.ext.indexOf(ext) < 0) return Promise.resolve({ ok: false, code: "bad_extension", detail: ext || file.name });
    if (RULES.mime.indexOf(String(file.type).toLowerCase()) < 0) {
      return Promise.resolve({ ok: false, code: "bad_type", detail: file.type || "unknown" });
    }
    if (!file.size) return Promise.resolve({ ok: false, code: "empty_file" });
    if (file.size > RULES.maxBytesPerFile) {
      return Promise.resolve({ ok: false, code: "too_large", detail: Math.round(file.size / 1024) + "KB" });
    }
    return readHead(file, 16).then(function (head) {
      var sig = matchSignature(head);
      if (!sig) return { ok: false, code: "not_an_image" };
      /* jpg/jpeg are the same format; otherwise the declared type must match
         what the bytes actually are. */
      var declared = String(file.type).toLowerCase();
      if (sig !== declared) return { ok: false, code: "type_mismatch", detail: declared + " vs " + sig };
      return { ok: true, mime: sig, ext: ext, size: file.size };
    }).catch(function () { return { ok: false, code: "read_failed" }; });
  }

  function dataUrl(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onerror = function () { reject(new Error("read_failed")); };
      r.onload = function () { resolve(String(r.result || "")); };
      r.readAsDataURL(file);
    });
  }

  /* Rough measure of what images already occupy in the persisted store, so a
     batch that would not fit is refused before anything is written. */
  function localBytesUsed() {
    try {
      var raw = localStorage.getItem("tsumugi.db.v8") || localStorage.getItem("tsumugi.db.v7") || "";
      var m = raw.match(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g) || [];
      return m.reduce(function (t, s) { return t + s.length; }, 0);
    } catch (e) { return 0; }
  }

  var localProvider = {
    NAME: "local",
    /* Resolves { accepted: [{src, thumb, alt, bytes}], rejected: [{name, code}] }.
       The caller reports success only for what is in `accepted`, and only after
       this promise settles. */
    intake: function (fileList) {
      var files = Array.prototype.slice.call(fileList || []);
      var accepted = [], rejected = [];
      if (!files.length) return Promise.resolve({ accepted: accepted, rejected: rejected });

      if (files.length > RULES.maxFilesPerBatch) {
        files.slice(RULES.maxFilesPerBatch).forEach(function (f) {
          rejected.push({ name: f.name, code: "too_many_files" });
        });
        files = files.slice(0, RULES.maxFilesPerBatch);
      }

      var budget = RULES.maxLocalTotalBytes - localBytesUsed();

      return files.reduce(function (chain, file) {
        return chain.then(function () {
          return validate(file).then(function (v) {
            if (!v.ok) { rejected.push({ name: file.name, code: v.code, detail: v.detail }); return; }
            /* base64 inflates by about a third; charge the budget for what will
               actually be stored, not for the file on disk. */
            var stored = Math.ceil(file.size * 4 / 3);
            if (stored > budget) { rejected.push({ name: file.name, code: "storage_budget" }); return; }
            return dataUrl(file).then(function (src) {
              if (!/^data:image\/(png|jpeg|webp|avif);base64,/.test(src)) {
                rejected.push({ name: file.name, code: "not_an_image" });
                return;
              }
              budget -= src.length;
              accepted.push({
                src: src, thumb: src, bytes: src.length, mime: v.mime,
                alt: String(file.name).replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 120)
              });
            }).catch(function () { rejected.push({ name: file.name, code: "read_failed" }); });
          });
        });
      }, Promise.resolve()).then(function () {
        return { accepted: accepted, rejected: rejected };
      });
    }
  };

  var supabaseProvider = {
    NAME: "supabase",
    /* Same contract, different destination. The object path is built from
       server-side ids and a UUID — never from the uploaded filename, so a name
       like "../../avatars/x.png" cannot steer the write. Storage RLS enforces
       the same shape (see supabase/migrations/0007_payments_and_storage.sql). */
    intake: function (fileList, opts) {
      var files = Array.prototype.slice.call(fileList || []).slice(0, RULES.maxFilesPerBatch);
      var accepted = [], rejected = [];
      var bucket = (opts && opts.bucket) === "content-images" ? "content-images" : "product-images";
      /* Never let a caller mix a content path into the product bucket. New,
         not-yet-saved records get a UUID namespace that already satisfies the
         Storage policy; their public URL remains valid after the DB row gets
         its numeric id. */
      var prefix = bucket === "content-images" ? "content" : "products";
      var ownerId = String((opts && opts.ownerId) || "").replace(/[^0-9a-f-]/gi, "").slice(0, 40);
      if (!ownerId) ownerId = crypto.randomUUID();

      return window.TSUMUGI_SUPABASE_CLIENT().then(function (client) {
        return files.reduce(function (chain, file) {
          return chain.then(function () {
            return validate(file).then(function (v) {
              if (!v.ok) { rejected.push({ name: file.name, code: v.code, detail: v.detail }); return; }
              var ext = v.mime === "image/jpeg" ? "jpg" : v.mime.split("/")[1];
              var path = prefix + "/" + ownerId + "/" + crypto.randomUUID() + "." + ext;
              return client.storage.from(bucket).upload(path, file, {
                contentType: v.mime, cacheControl: "31536000", upsert: false
              }).then(function (res) {
                if (res.error) { rejected.push({ name: file.name, code: "upload_failed", detail: res.error.message }); return; }
                var pub = client.storage.from(bucket).getPublicUrl(path);
                accepted.push({
                  src: pub.data.publicUrl, thumb: pub.data.publicUrl, path: path,
                  bytes: file.size, mime: v.mime,
                  alt: String(file.name).replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 120)
                });
              });
            });
          });
        }, Promise.resolve());
      }).then(function () {
        return { accepted: accepted, rejected: rejected };
      }).catch(function (e) {
        files.forEach(function (f) { rejected.push({ name: f.name, code: "upload_failed", detail: String(e) }); });
        return { accepted: accepted, rejected: rejected };
      });
    }
  };

  var configured = !!(window.TSUMUGI_AUTH_CONFIG && window.TSUMUGI_AUTH_CONFIG.url && window.TSUMUGI_AUTH_CONFIG.anonKey);

  window.TSUMUGI_IMAGES = {
    RULES: RULES,
    PROVIDER: configured ? "supabase" : "local",
    validate: validate,
    asset: function (relativePath) {
      return new URL(String(relativePath || "").replace(/^\/+/, ""), ASSET_BASE).href;
    },
    intake: function (fileList, opts) {
      var P = (configured && window.TSUMUGI_SUPABASE_CLIENT) ? supabaseProvider : localProvider;
      return P.intake(fileList, opts);
    },
    /* Human-readable reason, for a toast. Keys mirror the codes above. */
    reason: function (code, lang) {
      var ja = lang === "ja";
      var M = {
        bad_extension: ja ? "対応していない拡張子です（jpg / png / webp / avif）" : "Unsupported file extension (jpg, png, webp, avif).",
        bad_type: ja ? "画像ファイルではありません" : "Not an image file.",
        not_an_image: ja ? "画像として読み取れませんでした" : "The file is not a readable image.",
        type_mismatch: ja ? "ファイルの中身と拡張子が一致しません" : "The file's contents do not match its extension.",
        too_large: ja ? "1ファイル3MBまでです" : "Each file must be 3 MB or smaller.",
        too_many_files: ja ? "一度に追加できるのは8点までです" : "Up to 8 images at a time.",
        empty_file: ja ? "空のファイルです" : "The file is empty.",
        storage_budget: ja ? "このブラウザの保存容量に収まりません" : "This browser cannot store any more images.",
        read_failed: ja ? "ファイルを読み取れませんでした" : "The file could not be read.",
        upload_failed: ja ? "アップロードに失敗しました" : "The upload failed."
      };
      return M[code] || (ja ? "追加できませんでした" : "The image could not be added.");
    }
  };
})();
