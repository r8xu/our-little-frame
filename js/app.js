// Main app: boot, login gate, rendering the frame, reveal flow, modals and extras.
(function () {
  const CFG = window.APP_CONFIG || {};
  const S = (OF.S = { settings: {}, categories: [], milestones: [], secrets: {}, notes: [], guestbook: [], me: null, preview: new Set(), busy: 0 });
  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  const KINDS = {
    letter: "A love letter", photo: "A photograph", memory: "A memory", promise: "A promise",
    choice: "A little choice", coupon: "A coupon", typewriter: "A secret message", capsule: "A time capsule"
  };
  OF.KINDS = KINDS;

  /* tiny DOM helper */
  OF.h = function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "value" || k === "checked" || k === "selected" || k === "disabled") e[k] = v;
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat()) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(c)); }
    return e;
  };
  const h = OF.h;

  let toastT;
  OF.toast = function (msg, isErr) {
    const t = $("#toast"); t.textContent = msg; t.className = "toast show" + (isErr ? " err" : "");
    clearTimeout(toastT); toastT = setTimeout(() => (t.className = "toast"), isErr ? 5000 : 2800);
  };
  OF.fail = e => { console.error(e); OF.toast(e && e.message ? e.message : String(e), true); };

  const fmtDate = d => { try { return new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }); } catch { return d; } };
  OF.fmtDate = fmtDate;

  /* ───────── status helpers ───────── */
  OF.status = m => {
    if (S.preview.has(m.id)) return "available";
    if (m.revealed_at) return "revealed";
    return OF.isOpen(m) ? "available" : "sealed";
  };
  const condition = m => ({
    date: m.target_date ? `Opens on ${fmtDate(m.target_date)}` : "Opens on a special day",
    manual: "Opens when it really happens ♡",
    sealed: "Sealed for now… ♡",
    future: "Not imagined yet ♡",
    birthday: ""
  }[m.unlock_mode] || "");
  const sorted = arr => [...arr].sort((a, b) => (a.sort || 0) - (b.sort || 0));
  OF.liveMilestones = () => S.milestones.filter(m => !m.archived);

  /* ───────── boot ───────── */
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src)); document.head.append(s); });
  }

  OF.boot = async function () {
    document.documentElement.classList.add("js");
    $("#btn-sound").addEventListener("click", toggleSound);
    $("#btn-out").addEventListener("click", async () => { await OF.store.signOut(); location.reload(); });
    $("#gate-form").addEventListener("submit", onLogin);
    floaty();
    try {
      if (CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY) {
        await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js");
        OF.store = OF.supabaseStore(CFG);
      } else {
        OF.store = OF.localStore();
      }
      const me = await OF.store.init();
      if (me.needsLogin) return showGate();
      if (me.error) { showGate(me.error, true); return; }
      S.me = me; await start();
    } catch (e) {
      console.error(e); showGate("Something went wrong loading our world: " + e.message, true);
    }
  };

  function showGate(msg, noForm) {
    $("#app").hidden = true; $("#gate").hidden = false;
    if (msg) $("#gate-msg").textContent = msg;
    if (noForm) { $("#gate-form").querySelectorAll("label,button").forEach(x => (x.hidden = true)); if (OF.store && OF.store.mode === "supabase") { const b = h("button", { class: "btn", type: "button", onclick: async () => { await OF.store.signOut(); location.reload(); } }, "Sign out"); $("#gate-form").append(b); } }
  }
  async function onLogin(e) {
    e.preventDefault(); const err = $("#gate-err"); err.textContent = "";
    try {
      await OF.store.signIn($("#gate-email").value.trim(), $("#gate-pass").value);
      location.reload();
    } catch (ex) { err.textContent = ex.message === "Invalid login credentials" ? "That email or password isn't right." : ex.message; }
  }

  async function start() {
    $("#gate").hidden = true; $("#app").hidden = false;
    $("#btn-out").hidden = !OF.store.needsLogin;
    if (S.me.role === "admin") { $("#btn-admin").hidden = false; $("#btn-admin").onclick = () => OF.openAdmin && OF.openAdmin(); }
    if (OF.store.mode === "local") {
      const b = $("#demo-banner"); b.hidden = false;
      b.replaceChildren("Demo mode – everything is saved only in this browser, so it is not shared yet. ",
        h("button", { class: "linklike", onclick: () => { if (confirm("Reset all demo data in this browser?")) { OF.store.resetDemo(); location.reload(); } } }, "Reset demo"));
    }
    await OF.reload(true);
    OF.store.subscribe(() => {
      if (S.busy) return;
      const wait = (S.quietUntil || 0) - Date.now();      // don't redraw the frame in the middle of our own reveal animation
      wait > 0 ? setTimeout(() => !S.busy && OF.reload(), wait + 100) : OF.reload();
    });
    observeReveal();
  }

  OF.reload = async function (first) {
    try {
      Object.assign(S, await OF.store.loadAll());
      if (!first) S.busyRender = true;
      renderAll();
    } catch (e) { OF.fail(e); if (first) showGate("I couldn't load our world: " + e.message, true); }
  };

  /* ───────── render ───────── */
  function renderAll() {
    renderHero(); renderFrame(); renderExtras(); observeReveal();
    if (OF.onDataChanged) OF.onDataChanged();
  }
  OF.renderAll = renderAll;

  function renderHero() {
    const s = S.settings;
    $("#hero-title").textContent = s.greeting || "";
    $("#hero-sub").textContent = s.subtitle || "";
    const L = $("#hero-letter");
    L.replaceChildren(...String(s.letter || "").split(/\n{2,}/).map(p => h("p", { text: p })));
    L.hidden = !s.letter;
  }

  function renderFrame() {
    const root = $("#chapters"); root.replaceChildren();
    const cats = sorted(S.categories);
    const live = OF.liveMilestones();
    if (!live.length) {
      root.append(h("div", { class: "empty" }, S.me.role === "admin"
        ? [h("p", { class: "hand" }, "The frame is empty, for now."), h("button", { class: "btn", onclick: () => OF.openAdmin && OF.openAdmin("sample") }, "Open the editor ♡")]
        : [h("p", { class: "hand" }, "Something lovely is being put together… check back soon ♡")]));
      return;
    }
    const groups = cats.map(c => ({ c, items: sorted(live.filter(m => m.category_id === c.id)) }));
    const orphans = sorted(live.filter(m => !cats.some(c => c.id === m.category_id)));
    if (orphans.length) groups.push({ c: { id: "_", title: "Little Extras", subtitle: "" }, items: orphans });
    groups.forEach(({ c, items }, gi) => {
      if (!items.length) return;
      const sec = h("section", { class: "chapter rv" },
        h("header", { class: "chapter-head" },
          h("span", { class: "roman hand" }, `Chapter ${ROMAN[gi] || gi + 1}`),
          h("h2", { text: c.title }), c.subtitle && h("p", { class: "hand", text: c.subtitle })),
        h("div", { class: "frame" }, h("div", { class: "grid" }, items.map(m => buildSlot(m, gi)))));
      root.append(sec);
    });
  }

  function buildSlot(m, theme) {
    const st = OF.status(m);
    const sec = S.secrets[m.id] || {};
    const cell = h("div", { class: `cell st-${st}`, "data-id": m.id });
    const preview = (sec.message || "").replace(/\s+/g, " ").slice(0, 70);
    cell.append(
      h("div", { class: "under" },
        h("div", { class: "u-icon", "aria-hidden": "true", text: m.icon || "💌" }),
        h("h3", { text: m.title }),
        preview && h("p", { class: "u-prev", text: preview + (sec.message && sec.message.length > 70 ? "…" : "") })),
      h("div", { class: "sparks", "aria-hidden": "true" }));
    const foot = h("div", { class: "foot-line" });
    if (st === "revealed") {
      cell.append(h("button", { class: "cover-btn", "aria-label": `Read again: ${m.title}`, onclick: () => OF.openModal(m) }));
      cell.append(h("span", { class: "opened-badge", title: "Opened", text: "♡" }));
      foot.append(h("button", { class: "mini", onclick: () => OF.openModal(m) }, "Read again ♡"),
        m.revealed_at && h("span", { class: "who", text: openedBy(m) }));
    } else {
      const canvas = h("canvas", { class: "foil", "aria-hidden": "true" });
      cell.append(canvas);
      const interactive = st === "available";
      if (!interactive) cell.append(h("div", { class: "lock-pill", text: "sealed" }));
      requestAnimationFrame(() => {
        const api = OF.mountFoil(cell, canvas, {
          theme, title: m.title, hint: m.hint, interactive,
          onStart: () => { S.busy++; }, onEnd: () => { S.busy = Math.max(0, S.busy - 1); },
          onReveal: () => onRevealed(m, cell)
        });
        cell._foil = api;
      });
      if (interactive) {
        foot.append(h("button", { class: "mini open", onclick: () => { cell._foil && cell._foil.reveal(); } }, "Open this little surprise ♡"));
      } else {
        foot.append(h("span", { class: "cond", text: condition(m) }));
      }
    }
    return h("div", { class: "slot" }, cell, foot);
  }

  function openedBy(m) {
    const d = new Date(m.revealed_at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    if (OF.store.mode === "local") return `opened ${d}`;
    return (m.revealed_by === S.me.uid ? "you opened it " : "opened by them ") + d;
  }

  async function onRevealed(m, cell) {
    const r = cell.getBoundingClientRect();
    OF.burst(r.left + r.width / 2, r.top + r.height / 2, 18); OF.chime();
    cell.classList.remove("st-available"); cell.classList.add("st-revealed", "pop");
    if (S.preview.has(m.id)) {
      OF.toast("Preview only – nothing was saved");
    } else {
      try { await OF.store.reveal(m.id); m.revealed_at = new Date().toISOString(); m.revealed_by = S.me.uid; OF.toast("You opened a new chapter of us ♡"); }
      catch (e) { OF.fail(e); return; }
    }
    renderExtras();
    S.busy = 0; S.quietUntil = Date.now() + 3000;
    // the frame re-renders when the keepsake is closed (see openModal), so the foil fade isn't interrupted
    setTimeout(() => OF.openModal(m, { fresh: true }), reduce() ? 0 : 900);
  }

  /* ───────── modal (keepsake) ───────── */
  OF.openModal = async function (m, opts = {}) {
    const sec = S.secrets[m.id] || {};
    const root = $("#modal-root"); const lastFocus = document.activeElement;
    const close = () => { wrap.classList.remove("open"); setTimeout(() => { wrap.remove(); lastFocus && lastFocus.focus && lastFocus.focus(); if (opts.fresh) { renderFrame(); observeReveal(); } }, 250); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    const body = h("div", { class: "keep-body" });
    const card = h("div", { class: "keepsake", role: "dialog", "aria-modal": "true", "aria-label": m.title },
      h("button", { class: "x", "aria-label": "Close", onclick: close }, "×"),
      h("div", { class: "k-icon", "aria-hidden": "true", text: m.icon || "💌" }),
      h("p", { class: "k-kind hand", text: opts.fresh ? "You opened a new chapter of us ♡" : KINDS[m.kind] || "" }),
      h("h2", { text: m.title }), body);
    const wrap = h("div", { class: "modal", onclick: e => { if (e.target === wrap) close(); } }, card);
    root.append(wrap); requestAnimationFrame(() => wrap.classList.add("open")); document.addEventListener("keydown", onKey);
    card.querySelector(".x").focus();

    if (sec.image_path) {
      const img = h("img", { class: "k-photo", alt: sec.caption || m.title, loading: "lazy" });
      body.append(h("figure", {}, img, sec.caption && h("figcaption", { class: "hand", text: sec.caption })));
      OF.store.imageUrl(sec.image_path).then(u => { if (u) img.src = u; else img.replaceWith(h("p", { class: "hand", text: "(the photo couldn't be loaded)" })); });
    } else if (sec.caption) body.append(h("p", { class: "hand", text: sec.caption }));

    const msg = sec.message || "";
    if (msg) {
      const p = h("div", { class: "k-text" + (m.kind === "typewriter" ? " type" : "") });
      body.append(p);
      if (m.kind === "typewriter" && !reduce()) typewrite(p, msg); else p.textContent = msg;
    } else if (!sec.image_path) {
      body.append(h("p", { class: "hand", text: "Nothing written here yet… to be filled in when the time comes ♡" }));
    }
    const act = sec.activity || {};
    if (m.kind === "choice" && Array.isArray(act.options) && act.options.length) body.append(choiceBlock(m, act.options));
    if (m.kind === "coupon") body.append(couponBlock(m, act.coupon || "One wish, granted ♡"));
    if (m.revealed_at) body.append(h("p", { class: "k-meta", text: `Opened ${fmtDate(m.revealed_at.slice(0, 10))}` }));
  };

  function typewrite(el, text) {
    let i = 0; const cursor = h("span", { class: "caret", text: "▌" }); el.append(cursor);
    const t = setInterval(() => { if (!el.isConnected) return clearInterval(t); i++; el.firstChild.nodeType === 3 ? (el.firstChild.nodeValue = text.slice(0, i)) : el.prepend(text.slice(0, i)); if (i >= text.length) { clearInterval(t); cursor.remove(); } }, 38);
    el.addEventListener("click", () => { clearInterval(t); el.textContent = text; });
  }
  const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  function choiceBlock(m, options) {
    const key = "ourframe-choice-" + m.id; const box = h("div", { class: "choices" });
    const draw = () => {
      const picked = lsGet(key);
      box.replaceChildren(...options.map(o => h("button", { class: "choice" + (picked === o ? " picked" : ""), "aria-pressed": picked === o, onclick: () => { lsSet(key, o); draw(); OF.toast("Good choice ♡ (saved on this device)"); } }, o)));
    };
    draw(); return h("div", {}, h("p", { class: "hand", text: "Pick one:" }), box);
  }
  function couponBlock(m, text) {
    const key = "ourframe-coupon-" + m.id; const wrap = h("div", { class: "coupon" });
    const draw = () => { const used = lsGet(key) === "1"; wrap.className = "coupon" + (used ? " used" : ""); wrap.replaceChildren(h("div", { class: "c-title hand", text: "COUPON" }), h("div", { class: "c-text", text }), h("button", { class: "mini", onclick: () => { lsSet(key, used ? "0" : "1"); draw(); } }, used ? "Redeemed ✓ (undo)" : "Mark as redeemed (this device)")); };
    draw(); return wrap;
  }

  /* ───────── extras ───────── */
  function renderExtras() {
    const root = $("#extras"); root.replaceChildren();
    const live = OF.liveMilestones().filter(m => !(m.secret_compartment && !OF.isOpen(m) && S.me.role !== "admin"));
    const opened = live.filter(m => m.revealed_at);
    const waiting = live.length - opened.length;

    // progress
    const dots = live.length <= 80 ? live.map(m => h("i", { class: m.revealed_at ? "on" : "" })) : [];
    root.append(h("div", { class: "x-card rv" }, h("h3", { text: "Our little shadow box" }),
      h("div", { class: "dots", "aria-hidden": "true" }, dots),
      h("p", { class: "hand big", text: `${opened.length} little surprise${opened.length === 1 ? "" : "s"} opened · ${waiting} waiting for their time` }),
      h("p", { class: "soft", text: "There's no rush. Each one opens when life is ready for it." }),
      h("button", { class: "btn ghost", onclick: openTimeline }, "Our timeline ♡")));

    // countdown
    const rd = S.settings.reunion_date;
    if (rd) {
      const days = Math.ceil((new Date(rd + "T00:00:00") - new Date(new Date().toDateString())) / 864e5);
      if (days >= 0) root.append(h("div", { class: "x-card rv count" }, h("h3", { text: S.settings.reunion_label || "Until we're together" }),
        h("p", { class: "num", text: days === 0 ? "Today!" : String(days) }), days > 0 && h("p", { class: "hand", text: days === 1 ? "day to go" : "days to go" })));
    }

    // random love note + date idea
    const noteBox = h("p", { class: "note-out hand", "aria-live": "polite" });
    const pick = kind => {
      const list = S.notes.filter(n => n.kind === kind);
      if (!list.length) { noteBox.textContent = kind === "love_note" ? "No notes yet…" : "No ideas yet…"; return; }
      noteBox.classList.remove("in"); void noteBox.offsetWidth;
      noteBox.textContent = list[Math.floor(Math.random() * list.length)].body; noteBox.classList.add("in");
    };
    root.append(h("div", { class: "x-card rv" }, h("h3", { text: "Little pick-me-ups" }),
      h("div", { class: "btn-row" },
        h("button", { class: "btn", onclick: () => pick("love_note") }, "Need a little love? ♡"),
        h("button", { class: "btn ghost", onclick: () => pick("date_idea") }, "Pick something for us to do ♡")), noteBox));

    // future letter
    if (S.settings.future_letter) {
      root.append(h("div", { class: "x-card rv" }, h("h3", { text: "A letter to future us" }),
        h("p", { class: "soft", text: "Written today, for whenever we need it." }),
        h("button", { class: "btn ghost", onclick: () => OF.openModal({ id: "_future", title: "To future us", icon: "💌", kind: "letter" }, { }) ,
          "data-future": "1" }, "Open the letter")));
      S.secrets._future = { message: S.settings.future_letter };
    }

    // guestbook
    const ta = h("textarea", { rows: 3, maxlength: 600, placeholder: "Leave a little message ♡", "aria-label": "Guestbook message" });
    const list = h("ul", { class: "guests" }, S.guestbook.map(g => h("li", {}, h("p", { text: g.body }), h("small", { class: "hand", text: `${g.author_name || ""} · ${new Date(g.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` }))));
    root.append(h("div", { class: "x-card wide rv" }, h("h3", { text: "Our guestbook" }), h("p", { class: "soft", text: "A private place for just the two of us." }),
      ta, h("button", { class: "btn", onclick: async () => { const t = ta.value.trim(); if (!t) return; try { await OF.store.addGuest(t); ta.value = ""; await OF.reload(); OF.toast("Posted ♡"); } catch (e) { OF.fail(e); } } }, "Leave it here"),
      S.guestbook.length ? list : h("p", { class: "soft", text: "No messages yet – be the first ♡" })));
  }

  function openTimeline() {
    const done = OF.liveMilestones().filter(m => m.revealed_at).sort((a, b) => a.revealed_at.localeCompare(b.revealed_at));
    const body = done.length
      ? h("ol", { class: "timeline" }, done.map(m => h("li", {}, h("span", { class: "t-ic", text: m.icon }), h("div", {}, h("b", { text: m.title }), h("br"), h("small", { class: "hand", text: fmtDate(m.revealed_at.slice(0, 10)) })), h("button", { class: "mini", onclick: () => OF.openModal(m) }, "Read"))))
      : h("p", { class: "hand", text: "Nothing opened yet – the first scratch starts the story ♡" });
    const wrap = h("div", { class: "modal open", onclick: e => { if (e.target === wrap) wrap.remove(); } },
      h("div", { class: "keepsake", role: "dialog", "aria-modal": "true", "aria-label": "Timeline" },
        h("button", { class: "x", "aria-label": "Close", onclick: () => wrap.remove() }, "×"),
        h("div", { class: "k-icon", text: "🕰️" }), h("h2", { text: "Our timeline" }), body));
    $("#modal-root").append(wrap);
  }

  /* ───────── misc ui ───────── */
  function toggleSound() {
    OF.sound.on = !OF.sound.on; const b = $("#btn-sound");
    b.firstChild.nodeValue = OF.sound.on ? "🔊" : "🔇"; b.setAttribute("aria-pressed", OF.sound.on); b.title = OF.sound.on ? "Sound (on)" : "Sound (off)";
    if (OF.sound.on) OF.chime();
  }
  function floaty() {
    if (reduce()) return; const box = $("#floaty"); const sym = ["♡", "✦", "♡", "🌸", "✧"];
    for (let i = 0; i < 14; i++) {
      const s = h("span", { text: sym[i % sym.length] });
      s.style.left = Math.random() * 100 + "%"; s.style.fontSize = 10 + Math.random() * 16 + "px";
      s.style.animationDuration = 16 + Math.random() * 18 + "s"; s.style.animationDelay = -Math.random() * 30 + "s";
      box.append(s);
    }
  }
  let io;
  function observeReveal() {
    const els = document.querySelectorAll(".rv:not(.in)");
    if (!("IntersectionObserver" in window) || reduce()) { els.forEach(e => e.classList.add("in")); return; }
    io = io || new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .08 });
    els.forEach(e => io.observe(e));
  }
  OF.openModalRaw = OF.openModal;
})();
