// Private editor drawer (only offered to the "admin" member; the database enforces it too).
(function () {
  const h = OF.h, S = OF.S;
  const $ = (s, r = document) => r.querySelector(s);
  let tab = "milestones", editing = null, drawer;

  const sorted = a => [...a].sort((x, y) => (x.sort || 0) - (y.sort || 0));
  const run = async fn => { try { await fn(); } catch (e) { OF.fail(e); } };
  const refresh = async () => { await OF.reload(); render(); };

  OF.openAdmin = function (what) {
    drawer = $("#drawer"); drawer.hidden = false; requestAnimationFrame(() => drawer.classList.add("open"));
    editing = null; tab = "milestones"; render();
    if (what === "sample") $("#seed-btn") && $("#seed-btn").focus();
  };
  const closeAdmin = () => { drawer.classList.remove("open"); setTimeout(() => (drawer.hidden = true), 250); };
  OF.onDataChanged = () => { if (drawer && !drawer.hidden && !editing) render(); };

  function render() {
    const tabs = [["milestones", "Milestones"], ["chapters", "Chapters"], ["words", "Words"], ["notes", "Notes"]];
    drawer.replaceChildren(
      h("div", { class: "dr-head" }, h("h2", { text: "Editor ✏️" }), h("button", { class: "x", "aria-label": "Close editor", onclick: closeAdmin }, "×")),
      OF.store.mode === "local" && h("p", { class: "dr-note", text: "Demo mode: edits stay in this browser only." }),
      h("nav", { class: "dr-tabs", role: "tablist" }, tabs.map(([k, l]) => h("button", { role: "tab", "aria-selected": tab === k, class: tab === k ? "on" : "", onclick: () => { tab = k; editing = null; render(); } }, l))),
      h("div", { class: "dr-body" }, editing ? editForm() : ({ milestones: listView, chapters: chaptersView, words: wordsView, notes: notesView })[tab]()));
  }

  /* ── milestones list ── */
  function chip(m) {
    const st = OF.status(m);
    return h("span", { class: "chip " + st, text: m.revealed_at ? "opened" : st === "available" ? "ready" : "sealed" });
  }
  function listView() {
    const out = [];
    const msgs = id => (S.secrets[id] || {}).message || "";
    out.push(h("div", { class: "btn-row" },
      h("button", { class: "btn", onclick: () => startEdit() }, "+ New milestone"),
      h("button", { class: "btn ghost", onclick: () => startEdit({ title: "Something we decide together", hint: "to be filled in later", icon: "❔", unlock_mode: "future", kind: "letter" }) }, "+ Undecided one")));
    if (!S.milestones.length) {
      out.push(h("p", { class: "soft", text: "Nothing here yet. You can start with a full set of sample milestones (every one is editable) or add your own." }),
        h("button", { id: "seed-btn", class: "btn", onclick: () => run(seed) }, "Load sample milestones"));
      return out;
    }
    const cats = sorted(S.categories); const groups = cats.map(c => [c, S.milestones.filter(m => m.category_id === c.id && !m.archived)]);
    const rest = S.milestones.filter(m => !m.archived && !cats.some(c => c.id === m.category_id));
    if (rest.length) groups.push([{ id: "_", title: "No chapter" }, rest]);
    groups.forEach(([c, items]) => {
      items = sorted(items); if (!items.length) return;
      out.push(h("h3", { class: "dr-h", text: c.title }));
      items.forEach((m, i) => out.push(h("div", { class: "row" },
        h("span", { class: "r-ic", text: m.icon }),
        h("div", { class: "r-main" }, h("b", { text: m.title }), h("div", {}, chip(m), m.secret_compartment && h("span", { class: "chip", text: "secret" }), /\[sample/.test(msgs(m.id)) && h("span", { class: "chip warn", text: "sample text" }))),
        h("div", { class: "r-btns" },
          h("button", { class: "ic", title: "Move up", "aria-label": "Move up", disabled: i === 0, onclick: () => run(() => move(items, i, -1)) }, "↑"),
          h("button", { class: "ic", title: "Move down", "aria-label": "Move down", disabled: i === items.length - 1, onclick: () => run(() => move(items, i, 1)) }, "↓"),
          h("button", { class: "ic", title: OF.isOpen(m) ? "Seal again" : "Unlock now", "aria-label": OF.isOpen(m) ? "Seal again" : "Unlock now", onclick: () => run(() => toggleUnlock(m)) }, OF.isOpen(m) ? "🔓" : "🔒"),
          h("button", { class: "ic", title: "Edit", "aria-label": "Edit", onclick: () => startEdit(m) }, "✎"),
          h("button", { class: "ic", title: "Archive", "aria-label": "Archive", onclick: () => run(async () => { await OF.store.saveMilestone({ ...m, archived: true }); await refresh(); OF.toast("Archived"); }) }, "🗃")))));
    });
    const arch = S.milestones.filter(m => m.archived);
    if (arch.length) {
      out.push(h("h3", { class: "dr-h", text: "Archived" }));
      arch.forEach(m => out.push(h("div", { class: "row dim" }, h("span", { class: "r-ic", text: m.icon }), h("div", { class: "r-main" }, h("b", { text: m.title })),
        h("div", { class: "r-btns" }, h("button", { class: "mini", onclick: () => run(async () => { await OF.store.saveMilestone({ ...m, archived: false }); await refresh(); }) }, "Restore"),
          h("button", { class: "mini danger", onclick: () => { if (confirm(`Delete "${m.title}" forever?`)) run(async () => { await OF.store.deleteMilestone(m.id); await refresh(); }); } }, "Delete")))));
    }
    return out;
  }
  async function move(items, i, d) {
    const a = items[i], b = items[i + d]; if (!b) return;
    const base = items.map((m, k) => ({ m, s: k + 1 })); // normalise
    const sa = base[i].s, sb = base[i + d].s;
    await Promise.all(base.map(({ m, s }) => OF.store.saveMilestone({ ...m, sort: m === a ? sb : m === b ? sa : s })));
    await refresh();
  }
  async function toggleUnlock(m) {
    if (OF.isOpen(m)) {
      if (m.unlock_mode === "birthday" || m.unlock_mode === "date") { OF.toast("This one opens by itself (birthday/date mode). Change its unlock mode to seal it.", true); return; }
      await OF.store.saveMilestone({ ...m, unlocked: false });
    } else await OF.store.saveMilestone({ ...m, unlocked: true });
    await refresh(); OF.toast(OF.isOpen(m) ? "Sealed" : "Unlocked ♡");
  }

  /* ── edit form ── */
  function startEdit(base) {
    const m = base && base.id ? { ...base } : {
      id: OF.uuid(), category_id: (sorted(S.categories)[0] || {}).id || null, title: "", hint: "", icon: "💌", kind: "letter",
      unlock_mode: "manual", target_date: null, unlocked: false, secret_compartment: false, archived: false, sort: 0, ...(base || {}), _new: true
    };
    const sec = { message: "", caption: "", image_path: null, activity: {}, ...(S.secrets[m.id] || {}) };
    editing = { m, sec: { ...sec, activity: { ...(sec.activity || {}) } } };
    render();
  }
  function field(label, input, help) { return h("label", { class: "f" }, h("span", { text: label }), input, help && h("small", { text: help })); }
  function editForm() {
    const { m, sec } = editing;
    const inp = (obj, key, extra = {}) => h("input", { type: "text", value: obj[key] || "", oninput: e => (obj[key] = e.target.value), ...extra });
    const sel = (obj, key, opts) => h("select", { onchange: e => { obj[key] = e.target.value || null; if (key === "kind" || key === "unlock_mode") render(); } }, opts.map(([v, l]) => h("option", { value: v, selected: (obj[key] || "") === v }, l)));
    const photoPrev = h("img", { class: "thumb", alt: "", hidden: !sec.image_path });
    if (sec.image_path) OF.store.imageUrl(sec.image_path).then(u => (photoPrev.src = u));
    const f = [
      h("button", { class: "linklike", onclick: () => { editing = null; render(); } }, "← back to list"),
      field("Title", inp(m, "title", { required: true, maxlength: 120 })),
      field("Hint (shown on the foil)", inp(m, "hint", { maxlength: 140 }), "Visible to her while it's still sealed – don't spoil the surprise here."),
      h("div", { class: "two" }, field("Icon (emoji)", inp(m, "icon", { maxlength: 8 })),
        field("Chapter", sel(m, "category_id", [["", "— none —"], ...sorted(S.categories).map(c => [c.id, c.title])]))),
      field("What's inside", sel(m, "kind", Object.entries(OF.KINDS))),
      field("When can it be opened?", sel(m, "unlock_mode", [
        ["birthday", "Right away (birthday)"], ["date", "On a date"], ["manual", "When I mark it ready"],
        ["sealed", "Always sealed until I unlock it"], ["future", "Future surprise (decide later)"]])),
      m.unlock_mode === "date" && field("Date", h("input", { type: "date", value: m.target_date || "", onchange: e => (m.target_date = e.target.value || null) }), "Dates use UTC, so it may open a few hours early/late in your timezone."),
      m.unlock_mode !== "birthday" && m.unlock_mode !== "date" && field("Ready now?", h("label", { class: "chk" }, h("input", { type: "checkbox", checked: !!m.unlocked, onchange: e => (m.unlocked = e.target.checked) }), " Yes, she can scratch it open")),
      h("label", { class: "chk" }, h("input", { type: "checkbox", checked: !!m.secret_compartment, onchange: e => (m.secret_compartment = e.target.checked) }), " Secret compartment (completely hidden from her until it's ready)"),
      h("hr"),
      field("Hidden message / letter", h("textarea", { rows: 8, oninput: e => (sec.message = e.target.value) }, sec.message || "")),
      field("Photo caption", inp(sec, "caption", { maxlength: 200 })),
      field("Photo", h("div", {}, photoPrev, h("input", { type: "file", accept: "image/*", onchange: e => run(async () => { const file = e.target.files[0]; if (!file) return; sec.image_path = await OF.store.uploadImage(file); photoPrev.hidden = false; photoPrev.src = await OF.store.imageUrl(sec.image_path); OF.toast("Photo ready – remember to Save"); }) }),
        sec.image_path && h("button", { class: "mini", onclick: () => { sec.image_path = null; render(); } }, "Remove photo"))),
      m.kind === "choice" && field("Choices (one per line)", h("textarea", { rows: 4, oninput: e => (sec.activity.options = e.target.value.split("\n").map(s => s.trim()).filter(Boolean)) }, (sec.activity.options || []).join("\n"))),
      m.kind === "coupon" && field("Coupon text", h("input", { type: "text", value: sec.activity.coupon || "", oninput: e => (sec.activity.coupon = e.target.value) })),
      h("div", { class: "btn-row" },
        h("button", { class: "btn", onclick: () => run(save) }, "Save ♡"),
        h("button", { class: "btn ghost", onclick: previewScratch }, "Preview scratch"),
        m.revealed_at && h("button", { class: "btn ghost", onclick: () => run(async () => { await OF.store.saveMilestone({ ...m, revealed_at: null, revealed_by: null }); editing.m.revealed_at = null; await OF.reload(); render(); OF.toast("Reset – it can be opened again"); }) }, "Reset (un-open)"))
    ];
    return f;
  }
  async function save() {
    const { m, sec } = editing;
    if (!m.title.trim()) throw new Error("Please give it a title.");
    if (m.unlock_mode === "date" && !m.target_date) throw new Error("Pick a date, or choose another unlock mode.");
    const { _new, ...row } = m;
    if (_new) row.sort = Math.max(0, ...S.milestones.filter(x => x.category_id === row.category_id).map(x => x.sort || 0)) + 1;
    await OF.store.saveMilestone(row, sec);
    editing = null; await OF.reload(); render(); OF.toast("Saved ♡");
  }
  async function previewScratch() {
    const id = editing.m.id;
    try { await save(); } catch (e) { return OF.fail(e); }
    S.preview.add(id); OF.renderAll(); closeAdmin();   // fresh foil, local only – nothing is saved while previewing
    const el = document.querySelector(`[data-id="${id}"]`);
    el && el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ── chapters ── */
  function chaptersView() {
    const cats = sorted(S.categories);
    return [
      ...cats.map((c, i) => h("div", { class: "row col" },
        h("input", { type: "text", value: c.title, "aria-label": "Chapter title", onchange: e => run(async () => { await OF.store.saveCategory({ ...c, title: e.target.value }); await refresh(); }) }),
        h("input", { type: "text", value: c.subtitle || "", placeholder: "little subtitle", "aria-label": "Chapter subtitle", onchange: e => run(async () => { await OF.store.saveCategory({ ...c, subtitle: e.target.value }); await refresh(); }) }),
        h("div", { class: "r-btns" },
          h("button", { class: "ic", disabled: i === 0, "aria-label": "Move up", onclick: () => run(async () => { await swapCat(cats, i, -1); }) }, "↑"),
          h("button", { class: "ic", disabled: i === cats.length - 1, "aria-label": "Move down", onclick: () => run(async () => { await swapCat(cats, i, 1); }) }, "↓"),
          h("button", { class: "mini danger", onclick: () => { if (confirm("Delete this chapter? Its milestones stay, but lose their chapter.")) run(async () => { await OF.store.deleteCategory(c.id); await refresh(); }); } }, "Delete")))),
      h("button", { class: "btn", onclick: () => run(async () => { await OF.store.saveCategory({ id: OF.uuid(), title: "New chapter", subtitle: "", sort: cats.length + 1 }); await refresh(); }) }, "+ New chapter")
    ];
  }
  async function swapCat(cats, i, d) {
    const a = cats[i], b = cats[i + d];
    await Promise.all(cats.map((c, k) => OF.store.saveCategory({ ...c, sort: c === a ? i + d + 1 : c === b ? i + 1 : k + 1 })));
    await refresh();
  }

  /* ── words ── */
  function wordsView() {
    const s = { ...S.settings };
    const t = (k, label, rows, help) => field(label, rows ? h("textarea", { rows, oninput: e => (s[k] = e.target.value) }, s[k] || "") : h("input", { type: "text", value: s[k] || "", oninput: e => (s[k] = e.target.value) }), help);
    return [
      t("greeting", "Big greeting"), t("subtitle", "Handwritten subtitle", 2), t("letter", "Opening letter", 9, "Blank line = new paragraph."),
      t("future_letter", "Letter to future us (optional)", 7, "Leave empty to hide that section."),
      t("reunion_label", "Countdown label (optional)", 0, "e.g. “Until I see you again”"),
      field("Countdown date (optional)", h("input", { type: "date", value: s.reunion_date || "", onchange: e => (s.reunion_date = e.target.value || null) })),
      h("button", { class: "btn", onclick: () => run(async () => { const { id, updated_at, ...rest } = s; await OF.store.saveSettings(rest); await refresh(); OF.toast("Saved ♡"); }) }, "Save words ♡")
    ];
  }

  /* ── notes ── */
  function notesView() {
    const block = (kind, title, ph) => {
      const ta = h("input", { type: "text", placeholder: ph, "aria-label": title });
      return [h("h3", { class: "dr-h", text: title }),
        ...S.notes.filter(n => n.kind === kind).map(n => h("div", { class: "row" }, h("div", { class: "r-main", text: n.body }), h("button", { class: "mini danger", onclick: () => run(async () => { await OF.store.deleteNote(n.id); await refresh(); }) }, "Remove"))),
        h("div", { class: "row col" }, ta, h("button", { class: "mini", onclick: () => run(async () => { if (!ta.value.trim()) return; await OF.store.saveNote({ id: OF.uuid(), kind, body: ta.value.trim() }); await refresh(); }) }, "Add"))];
    };
    return [...block("love_note", "Love notes (“Need a little love?”)", "Write a little note…"), ...block("date_idea", "Date ideas (“Pick something for us”)", "A date idea…")];
  }

  /* ── sample data ── */
  async function seed() {
    const ids = [];
    for (let i = 0; i < OF.CATEGORIES.length; i++) {
      const c = { id: OF.uuid(), ...OF.CATEGORIES[i], sort: i + 1 }; ids.push(c.id); await OF.store.saveCategory(c);
    }
    const modes = { b: "birthday", d: "date", m: "manual", s: "sealed", f: "future" };
    let n = 0;
    for (const [ch, icon, title, hint, mode, kind, message, extra] of OF.SAMPLE_MILESTONES) {
      await OF.store.saveMilestone({
        id: OF.uuid(), category_id: ids[ch], title, hint, icon, kind, unlock_mode: modes[mode], target_date: null,
        unlocked: false, secret_compartment: false, archived: false, sort: ++n
      }, { message, caption: "", image_path: null, activity: extra || {} });
    }
    // one secret compartment, hidden from her until you unlock it
    await OF.store.saveMilestone({ id: OF.uuid(), category_id: ids[5], title: "Psst… you found the secret compartment", hint: "shhh", icon: "🗝️", kind: "typewriter", unlock_mode: "sealed", unlocked: false, secret_compartment: true, archived: false, sort: ++n },
      { message: "A secret only we know about. [sample – edit me]", caption: "", image_path: null, activity: {} });
    for (const note of OF.SAMPLE_NOTES) await OF.store.saveNote({ id: OF.uuid(), ...note });
    await refresh(); OF.toast("Sample milestones loaded – now make them yours ♡");
  }
})();
