# TSUMUGI — authentication, authorization and deployment

For the non-engineer, account-by-account deployment checklist, use
`GITHUB_SUPABASE_SETUP_JA.md`. This document remains the security design and
audit reference. Migration `0011_cms_runtime.sql` adds the CMS fields,
home/shop feature tables, public filtered view, staff-only writes and atomic
hero ordering used by `tsumugi-repository.js`.

This document describes what the code actually does. Where an earlier version of
this file was wrong, the correction is marked **[corrected]** with the reason —
the previous text was not merely incomplete, it was unsafe to copy.

---

## 1. The four subjects

Every policy in `supabase/migrations/` names which of these it is written for.
Nothing relies on "authenticated means a customer".

| # | Subject | Postgres role | Distinguishing test |
|---|---------|---------------|---------------------|
| 1 | Public visitor | `anon` | no session |
| 2 | Customer | `authenticated` | `app.is_account()` — uid present, `is_anonymous` false |
| 3 | Staff | `authenticated` | `app.is_staff()` / `app.has_role(…)` — live `staff_roles` row |
| 4 | Anonymous demo guest | `authenticated` | `app.is_anonymous()` — JWT `is_anonymous` = true |

**[corrected]** The earlier text said anonymous sign-ins fall under the `anon`
role. They do not. `supabase.auth.signInAnonymously()` mints a real user and a
real JWT; in Postgres that request arrives as **`authenticated`**. Every policy
written `to authenticated` therefore applied to the demo guest as well — which
is how the guest console came to hold read access to real orders and real
customers. The only reliable discriminator is the `is_anonymous` claim, so
`app.is_anonymous()` appears in every authenticated-facing policy, and
`app.is_account()` is what customer policies actually test.

---

## 2. Where a staff role comes from

One source of truth: **`public.staff_roles`** (migration `0002`).

- No `select`, `insert`, `update` or `delete` grant to `anon` or `authenticated`.
- RLS enabled with **zero policies** — which denies everyone; `service_role`
  bypasses RLS and is the only way in.
- Postgres reads it through `app.staff_role()` (security definer).
- The browser reads the same value from the JWT's `app_metadata.role`, which the
  `staff_roles_sync_claim` trigger mirrors from that table. `app_metadata` is
  server-owned: no client SDK call can write it.

`tsumugi-auth.js` reads `app_metadata.role` and nothing else. An unrecognised
value resolves to `customer`, whose console permission list is empty.

**[corrected]** The earlier design read `profiles.role` first, and its own RLS
example granted `update on profiles using (id = auth.uid())` across the whole
row. Those two facts together meant a customer could run

```sql
update profiles set role = 'owner' where id = auth.uid();
```

and the console believed it. `profiles.role` no longer exists. **[corrected]**
The earlier `unknown role → owner` fallback in both `tsumugi-data.js` and
`tsumugi-auth.js` is gone: `roleOf()` now returns `denied` (empty permissions)
for anything unrecognised, and a stored session with no role resolves to
`customer`, never to an operator.

### Granting a role

Service-role context only (SQL editor or an Edge Function) — staff cannot create
staff:

```sql
insert into public.staff_roles (user_id, role, note)
select id, 'owner', 'initial operator'
from auth.users where email = 'owner@example.com'
on conflict (user_id) do update
  set role = excluded.role, revoked_at = null, granted_at = now();
```

Revoking keeps the audit row and drops the claim on the user's next token
refresh; delete their `auth.sessions` rows for immediate effect.

---

## 3. What a customer may write

Two independent mechanisms, deliberately doubled (migration `0003`):

1. **RLS** decides *which rows* — their own, never another's.
2. **Column grants** decide *which columns* an `update` may name. RLS cannot
   express that:

```sql
revoke all on table public.profiles from anon, authenticated;
grant select (id, display_name, phone, customer_id, marketing_opt_in, created_at, updated_at)
  on public.profiles to authenticated;
grant update (display_name, phone, marketing_opt_in) on public.profiles to authenticated;
```

An `update` naming `customer_id` is a permission error before any policy runs.
`customer_id` changes only through `app.link_customer_record()`, which is not
granted to either public role.

---

## 4. Access matrix

`—` = no grant and no policy: the request returns zero rows or a permission
error. This is the table to check a change against.

### Tables

| Object | 1 · anon | 2 · customer | 3 · staff | 4 · anon. guest |
|---|---|---|---|---|
| `staff_roles` | — | — | — | — |
| `profiles` | — | select/update own (3 columns) | select (support+) | — |
| `products` | select published | select published | select all; write editor+; delete manager+ | select published |
| `news` | select published/due | select published/due | select all; write editor+ | select published/due |
| `wishlists` | — | select/insert/delete own | — | — |
| `orders` | — | select own (projection) | select support+; update fulfilment/tracking | — |
| `order_items` | — | select own | select support+ | — |
| `order_receipts` | — | — | — | — |
| `contact_messages` | — (insert via function) | — | select support+; update `handled` | — |
| `newsletter_subscribers` | — (insert via function) | — | select manager+ | — |
| `payment_events` | — | — | select manager+ | — |
| `demo_orders` | — | — | select viewer+ | **select** |
| `demo_customers` | — | — | select viewer+ | **select** |
| `storage: product-images` | read | read | read; write editor+; delete manager+ | read |
| `storage: content-images` | read | read | read; write editor+; delete manager+ | read |

### Functions

| Function | Callable by | Notes |
|---|---|---|
| `app.is_anonymous()` / `is_account()` / `is_staff()` / `has_role()` | anon, authenticated | subject tests |
| `app.staff_role()` | anon, authenticated | security definer; reads `staff_roles` |
| `app.redeem_receipt(token)` | anon, authenticated | the token IS the authorization; single use, 30 min |
| `public.create_order(…)` | **service_role only** | called by the create-order Edge Function |
| `app.apply_payment_event(…)` | **service_role only** | called by the payment webhook |
| `app.link_customer_record(…)` | **service_role only** | the only writer of `profiles.customer_id` |

### Subject 4 in one line

The anonymous demo guest reads the **published catalogue** and the **synthetic
demo dataset**, and nothing else. It cannot see a real order, a real customer, a
real profile or an address, and it cannot write anywhere.

**[corrected]** Previously the local `guest` role carried `orders.view` and
`customers.view`, pointing at real records with PII merely masked in the UI.
Masking is a presentation choice; zero rows is a guarantee.

### Permissive-policy note

Policies for the same command are **OR**ed. One careless policy widens
everything before it. Every policy in these migrations therefore carries its own
subject test (`app.is_account()`, `app.has_role(…)`) instead of relying on
`to authenticated` to narrow it — an anonymous session satisfies
`to authenticated` and would otherwise slip through the OR.

---

## 5. Orders

- **Ownership XOR.** `check (num_nonnulls(user_id, guest_email) = 1)`.
  **[corrected]** The previous constraint permitted both columns to be set,
  which makes "whose order is this?" unanswerable — and an unanswerable owner is
  an unenforceable policy.
- **No client-set money or state.** `subtotal`, `total`, `payment_status` and
  `number` are not granted to any API role. `create_order` computes them;
  `app.apply_payment_event()` (payment webhook, service_role) is the only writer
  of `payment_status`. A browser cannot declare its own order paid.
- **No guest `select`.** A guest never reads this table. Completion is served
  once from the create-order response.
- **Ownership by uid, never by email.** An email typed at checkout is not
  evidence of ownership; matching on it would hand every guest order to whoever
  later signs up with that address.
- **Oversell.** Stock is decremented with a conditional update
  (`… where id = $1 and stock >= qty`). The loser of a race matches no row and
  the whole transaction rolls back.

### Completion screen

**[corrected]** The previous build reached `#/checkout/complete/<order-id>` and
called `Store.getOrder()` directly, so a guessed order number displayed a
stranger's email address. Now:

- the URL is `#/checkout/complete` with **no id**;
- a random 32-byte **receipt token** is returned by `create_order`, kept in
  `sessionStorage` (this tab only) and never placed in a URL;
- only the **SHA-256 hash** is stored server-side, `app.redeem_receipt()` is
  single-use with a 30-minute expiry, and an unknown token returns zero rows;
- what comes back is the customer projection — no internal notes, no status
  history, no audit rows;
- with no token the screen says the receipt is no longer on display and points a
  signed-in customer at their account.

---

## 6. Client auth behaviour

### No Supabase calls inside `onAuthStateChange`

The callback records the event and returns. Work is queued with `setTimeout(…, 0)`
and carries a monotonic `sessionVersion`; a resolution whose version is stale is
discarded, so a slow lookup for a session that has since been replaced cannot
land last and win. Supabase documents that calling further auth APIs inside the
callback can deadlock the client's internal lock — hence the queue.

Events are handled explicitly: `INITIAL_SESSION`, `SIGNED_IN`,
`TOKEN_REFRESHED`, `USER_UPDATED`, `SIGNED_OUT`, `PASSWORD_RECOVERY`,
`MFA_CHALLENGE_VERIFIED`, and a default branch that changes nothing. The
subscription is released by `TSUMUGI_AUTH.dispose()`.

### Scope is verified before a session is applied

**[corrected]** Previously `apply(session)` ran *before* the scope check, so
customer credentials typed into the console left a live customer session behind
(and staff credentials in the storefront left an admin session). Now
`enforceScope()` signs the Supabase session out and bumps `sessionVersion`
before returning `notStaff` / `notCustomer`. Regression coverage:
`shots/security-qa.html` → "Scope · no cross-scope session residue".

### Password recovery

`resetPassword()` redirects to `location.origin + location.pathname` without a
fragment. Supabase completes the PKCE exchange first; the resulting
`PASSWORD_RECOVERY` event then moves the shell to `#/account/recover`. The event
is recorded synchronously so a following `INITIAL_SESSION` / `SIGNED_IN` event
cannot supersede it. Recovery deliberately applies **no** ordinary session:
`isRecovering()` is true, the shell renders the recovery form, and only
`updatePassword()` may use that session. Expired/reused-link `#error=…` fragments
are mapped to the recovery screen, never to the catalogue 404.

---

## 7. Rich text

`tsumugi-sanitize.js` is the single sanitizer, applied **on save and on render**:

- allowlist of elements and attributes; everything else is dropped or unwrapped;
- `script`, `style`, `iframe`, `object`, `embed`, `form`, `svg`, `math`, `base`,
  comments and every `on*` and `style` attribute are removed;
- URLs: `http`, `https`, `mailto`, `tel`, same-document and site-relative only.
  `javascript:` survives neither case-folding, entity encoding nor embedded
  control characters, because the value is normalised before it is tested.
  Protocol-relative `//host` is refused.
- `data:` is accepted for `img` only, and only for a known raster type;
- external links get `rel="noopener noreferrer" target="_blank"`; an
  author-supplied `rel` is discarded rather than merged;
- parsing happens in an inert document (`DOMParser` / `<template>`), so nothing
  executes or fetches while being inspected;
- two passes, to prove a fixed point.

Applied at: the admin editor's initial load, the admin preview,
`Store.saveNews()` (storage) and the public article render. Coverage:
`shots/security-qa.html` → "XSS · sanitizer allowlist", including an
inserted-into-a-live-document proof.

---

## 8. Local demo vs Supabase

The local provider is **not** a security boundary — it is a portfolio demo whose
data lives in `localStorage`, where anything in the browser can rewrite it. What
was fixed is the *unintended privilege inversion*: a signed-out visitor could
previously call every admin mutation, because the store's gate passed a
sessionless caller straight through. Now:

| Caller | Admin API (`Store.ADMIN_API`) |
|---|---|
| signed out | refused (quietly — no console is open to be told) |
| customer session | refused, audited, toasted |
| anonymous guest | refused, audited, toasted |
| staff | allowed per `PERMS[role]` |

`Store.PUBLIC_API` is the separate storefront group (checkout, wishlist,
account, contact/newsletter intents), each member validating its own input.

Storage failures are no longer swallowed: `persist()` returns a result, admin
mutations run inside `transact()` and **roll back** if the write fails, and the
operator is told that the change was not saved.

---

## 9. Setting up Supabase

1. `auth-config.js` — set `url` and `anonKey`. **Publishable anon key only.**
   Never `service_role`, never a secret key, never an administrator password.
2. Run `supabase/migrations/*.sql` in order (`0001` → `0008`).
3. Authentication → Providers → **Anonymous sign-ins: enabled** (guest console).
4. Authentication → Providers → Email → **Confirm email: on**.
5. Authentication → URL Configuration:
   - **Site URL**: the deployed origin, e.g. `https://<user>.github.io/<repo>/`
   - **Redirect URLs**: that same deployed URL (no hash route)
6. Grant yourself a staff role (§2).
7. Deploy the functions and set their secrets:
   ```
   supabase functions deploy create-order
   supabase functions deploy contact
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=…
   supabase secrets set IP_HASH_SALT=…
   supabase secrets set CONTACT_TO=…
   ```
8. Edit `ALLOWED_ORIGINS` in both functions to the deployed origin(s). The
   wildcard is not used: these endpoints write.
9. Wire a payment provider's webhook to `app.apply_payment_event()`. Until then
   every order stays `pending`, and the storefront says nothing was charged.

### Human decisions this document does not make for you

- Which mail provider sends the contact and newsletter messages.
- The real postal address, phone number and business hours on the contact page.
- Whether guest checkout stays enabled.
- Data retention for `contact_messages` and `payment_events`.

---

## 10. Known limits

- **Hash-route SEO.** Titles, descriptions and canonicals are correct in the
  browser and for JS-executing crawlers. A non-JS crawler sees `index.html`'s
  metadata for every route. Per-route metadata needs build-time prerendering —
  see `BUILD.md`.
- **Runtime `new Function`.** The component runtime compiles logic at runtime, so
  a CSP without `unsafe-eval` is not possible for the source build. `BUILD.md`
  states what a production build would have to change; this is an open item, not
  a solved one.
- **Rate limiting** in the Edge Functions is per-instance and best-effort.
  Durable limits need a table or an external limiter.
- **Revoked staff** keep a stale `app_metadata.role` until their access token
  refreshes (default one hour) unless their sessions are deleted.
