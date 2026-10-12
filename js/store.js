// Data layer. Two interchangeable back-ends with the same API:
//  - localStore()    : DEMO MODE, saved only in this browser (localStorage)
//  - supabaseStore() : shared, private, synced (Supabase Auth + Postgres + Storage)
window.OF = window.OF || {};

OF.uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID() :
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16);
    }));

OF.utcToday = () => new Date().toISOString().slice(0, 10);

// Same rule as milestone_is_open() in schema.sql
OF.isOpen = m =>
  !!m.unlocked || m.unlock_mode === "birthday" ||
  (m.unlock_mode === "date" && !!m.target_date && m.target_date <= OF.utcToday());

// Shrink photos before saving/uploading
OF.resizeImage = (file, max = 1400, q = 0.82) => new Promise((res, rej) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    c.toBlob(b => b ? res(b) : rej(new Error("Could not read that image.")), "image/jpeg", q);
  };
  img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("That file doesn't look like an image.")); };
  img.src = url;
});

const blobToDataUrl = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });

/* ───────────────────────── DEMO MODE ───────────────────────── */
OF.localStore = function () {
  const KEY = "ourframe-demo-v1";
  const fresh = () => ({ settings: { ...OF.DEFAULT_SETTINGS }, categories: [], milestones: [], secrets: {}, notes: [], guestbook: [] });
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch { db = fresh(); }
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch { throw new Error("This browser's storage is full – try smaller photos."); }
  };
  const upsert = (arr, row, key = "id") => {
    const i = arr.findIndex(x => x[key] === row[key]);
    if (i >= 0) arr[i] = { ...arr[i], ...row }; else arr.push(row);
  };
  return {
    mode: "local",
    async init() { return { uid: "local", role: "admin", name: "You" }; },
    async signIn() {}, async signOut() {},
    async loadAll() { return JSON.parse(JSON.stringify(db)); },
    async reveal(id) {
      const m = db.milestones.find(x => x.id === id);
      if (m && !m.revealed_at) { m.revealed_at = new Date().toISOString(); m.revealed_by = "local"; save(); }
    },
    async saveMilestone(m, secret) {
      upsert(db.milestones, m);
      if (secret) db.secrets[m.id] = { ...(db.secrets[m.id] || {}), ...secret, milestone_id: m.id };
      save();
    },
    async deleteMilestone(id) { db.milestones = db.milestones.filter(m => m.id !== id); delete db.secrets[id]; save(); },
    async saveCategory(c) { upsert(db.categories, c); save(); },
    async deleteCategory(id) { db.categories = db.categories.filter(c => c.id !== id); db.milestones.forEach(m => { if (m.category_id === id) m.category_id = null; }); save(); },
    async saveSettings(s) { db.settings = { ...db.settings, ...s }; save(); },
    async saveNote(n) { upsert(db.notes, n); save(); },
    async deleteNote(id) { db.notes = db.notes.filter(n => n.id !== id); save(); },
    async addGuest(body) { db.guestbook.unshift({ id: OF.uuid(), author_id: "local", author_name: "You", body, created_at: new Date().toISOString() }); save(); },
    async uploadImage(file) { return blobToDataUrl(await OF.resizeImage(file, 1000, 0.75)); },
    async imageUrl(path) { return path; },
    subscribe() {},
    resetDemo() { localStorage.removeItem(KEY); db = fresh(); }
  };
};

/* ───────────────────────── SUPABASE ───────────────────────── */
OF.supabaseStore = function (cfg) {
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  let me = null;
  const open = !cfg.REQUIRE_LOGIN;            // simple mode: no accounts, everyone with the link is "in"
  const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  const urlCache = new Map();

  return {
    mode: "supabase",
    needsLogin: !open,
    async init() {
      if (open) {
        let id; try { id = localStorage.getItem("ourframe-device"); if (!id) localStorage.setItem("ourframe-device", (id = OF.uuid())); } catch { id = OF.uuid(); }
        const edit = /[?&#]edit\b/.test(location.search + location.hash);   // add ?edit to the link to get the editor
        me = { uid: id, role: edit ? "admin" : "partner", name: edit ? "Me" : "Her" };
        return me;
      }
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return { needsLogin: true };
      const mem = ok(await sb.from("members").select("role,display_name").eq("user_id", session.user.id).maybeSingle());
      if (!mem) return { error: "This account hasn't been invited to our little world yet." };
      me = { uid: session.user.id, role: mem.role, name: mem.display_name || (mem.role === "admin" ? "Me" : "You") };
      return me;
    },
    async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); },
    async signOut() { await sb.auth.signOut(); },
    async loadAll() {
      const [s, c, m, sec, n, g] = await Promise.all([
        sb.from("settings").select("*").eq("id", 1).maybeSingle(),
        sb.from("categories").select("*").order("sort"),
        sb.from("milestones").select("*").order("sort"),
        sb.from("milestone_secrets").select("*"),
        sb.from("notes").select("*").order("created_at"),
        sb.from("guestbook").select("*").order("created_at", { ascending: false }).limit(100)
      ]);
      const secrets = {};
      ok(sec).forEach(r => { secrets[r.milestone_id] = r; });
      return {
        settings: { ...OF.DEFAULT_SETTINGS, ...(ok(s) || {}) },
        categories: ok(c), milestones: ok(m), secrets, notes: ok(n), guestbook: ok(g)
      };
    },
    async reveal(id) {
      if (open) ok(await sb.from("milestones").update({ revealed_at: new Date().toISOString(), revealed_by: me.uid }).eq("id", id).is("revealed_at", null));
      else ok(await sb.rpc("reveal_milestone", { mid: id }));
    },
    async saveMilestone(m, secret) {
      const row = {
        id: m.id, category_id: m.category_id || null, title: m.title, hint: m.hint || "", icon: m.icon || "💌",
        kind: m.kind, unlock_mode: m.unlock_mode, target_date: m.target_date || null, unlocked: !!m.unlocked,
        secret_compartment: !!m.secret_compartment, archived: !!m.archived, sort: m.sort || 0,
        revealed_at: m.revealed_at || null, revealed_by: m.revealed_by || null
      };
      ok(await sb.from("milestones").upsert(row));
      if (secret) {
        ok(await sb.from("milestone_secrets").upsert({
          milestone_id: m.id, message: secret.message || "", caption: secret.caption || "",
          image_path: secret.image_path || null, activity: secret.activity || {}
        }));
      }
    },
    async deleteMilestone(id) { ok(await sb.from("milestones").delete().eq("id", id)); },
    async saveCategory(c) { ok(await sb.from("categories").upsert({ id: c.id, title: c.title, subtitle: c.subtitle || "", sort: c.sort || 0 })); },
    async deleteCategory(id) { ok(await sb.from("categories").delete().eq("id", id)); },
    async saveSettings(s) { ok(await sb.from("settings").update({ ...s, updated_at: new Date().toISOString() }).eq("id", 1)); },
    async saveNote(n) { ok(await sb.from("notes").upsert({ id: n.id, kind: n.kind, body: n.body })); },
    async deleteNote(id) { ok(await sb.from("notes").delete().eq("id", id)); },
    async addGuest(body) { ok(await sb.from("guestbook").insert(open ? { author_name: me.name, body } : { author_id: me.uid, author_name: me.name, body })); },
    async uploadImage(file) {
      if (open) return blobToDataUrl(await OF.resizeImage(file, 1000, 0.75));   // photos are stored inside the database – no storage setup needed
      const blob = await OF.resizeImage(file);
      const path = `${me.uid}/${OF.uuid()}.jpg`;
      ok(await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" }));
      return path;
    },
    async imageUrl(path) {
      if (!path) return "";
      if (path.startsWith("data:")) return path;
      const hit = urlCache.get(path);
      if (hit && hit.exp > Date.now()) return hit.url;
      const { data, error } = await sb.storage.from("photos").createSignedUrl(path, 3600);
      if (error) return "";
      urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 3000 * 1000 });
      return data.signedUrl;
    },
    subscribe(cb) {
      let t;
      const ping = () => { clearTimeout(t); t = setTimeout(cb, 400); };
      sb.channel("frame-sync")
        .on("postgres_changes", { event: "*", schema: "public" }, ping)
        .subscribe();
      document.addEventListener("visibilitychange", () => { if (!document.hidden) ping(); });
    }
  };
};
