# Our Little Frame ♡

A shared, scratch-off milestone shadow box. Plain HTML/CSS/JS (no build step), so it hosts for free on **GitHub Pages**. Supabase (free tier) provides private logins, the shared database and photo storage.

**Two modes**
- **Demo mode** (default): works immediately, but data lives only in one browser. Good for trying it out.
- **Shared mode**: you add your Supabase keys. Both of you sign in, everything syncs, and her locked surprises are protected by the database.

---

## Part 1 – Put it on GitHub Pages (5 min)

1. On github.com click **New repository**, name it e.g. `our-little-frame`. **Public** is required for free Pages and is fine here: the repo holds only code and sample text; your real letters and photos live in Supabase.
2. Upload every file from this folder (drag and drop into the repo page, or use git below). `.nojekyll` must be included.
3. Repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch `main`, folder `/ (root)` → Save.
4. After a minute your site is live at `https://YOUR-USERNAME.github.io/our-little-frame/`.

```bash
git remote add origin https://github.com/YOUR-USERNAME/our-little-frame.git
git push -u origin main
```

## Part 2 – Make it shared between your two phones (5 min, once)

Skip this and it still works, but each device keeps its own copy. To share it:

1. Create a free project at **supabase.com**.
2. **SQL Editor → New query** → paste all of `supabase/setup.sql` → **Run**.
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key into `js/config.js` (the two empty quotes). Commit/push.

That's all: no accounts and no passwords. You both just open the same link; opened cards stay opened on both phones.
To edit, open the link with `?edit` on the end (e.g. `https://you.github.io/our-little-frame/?edit`) and tap ✏️. Her normal link has no editor button.

## Part 3 – Make it yours

Open the link with `?edit`, then tap ✏️. Tabs:
- **Milestones**: add/edit, write the hidden letter, upload a photo, choose when it unlocks, move ↑↓, archive, 🔒/🔓 unlock, **Preview scratch**.
- **Chapters**: rename, reorder, add.
- **Words**: birthday greeting, intro letter, letter to future us, optional countdown.
- **Notes**: love notes and date ideas for the two buttons.

**Unlock modes:** *Right away*, *On a date*, *When I mark it ready* (engagement, wedding, "distance ends" should use this, or *Always sealed*), *Future surprise*. Tick **Secret compartment** to hide a milestone from her completely until you unlock it.

> ⚠️ The sample milestones are marked `[sample – edit me]`; the editor shows a yellow "sample text" tag. **Replace every one of those before giving her the link.**

## Good to know

- **Anyone with the link can open it**, and anyone technical could read hidden letters via the browser's network tools. Fine for a personal gift; just don't share the link publicly or put anything truly secret in it.
- Sealed cards stay sealed in the page (they can't be scratched until they unlock), but see the point above.
- Once scratched, a card stays opened (saved in Supabase, so it's opened on both phones). Scratching about a third of the foil, or lifting your finger after scratching a fair bit, opens it.
- "On a date" unlocks use UTC dates, so it may open a few hours early/late in your timezone.
- "Choice" picks and "redeemed" coupons are saved per device.
- Sound is off until you tap 🔇.
- Want real logins instead (private accounts, hidden letters protected by the database)? That's `supabase/schema-private.sql` plus `REQUIRE_LOGIN: true`; it's more setup, and not needed for this.

## Files

```
index.html          page
css/style.css       all styling
js/config.js        ← your Supabase keys go here
js/data.js          default text + sample milestones
js/store.js         demo (localStorage) and Supabase data layers
js/scratch.js       canvas scratch foil, sparkles, hearts, chime
js/app.js           rendering, reveal flow, keepsake modal, extras, login
js/admin.js         the ✏️ editor
supabase/setup.sql        simple database setup (use this)
supabase/schema-private.sql  optional: login + locked-down version
```

Run locally: `python3 -m http.server` then open http://localhost:8000.
