async function api(url, options) {
  const r = await fetch(url, options);
  if (r.status === 401) location.href = "login.html";
  return r;
}

const FRENCH_GRADES = ["4a","4b","4c","5a","5b","5c","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+","7c","7c+","8a","8a+","8b","8b+","8c","8c+","9a"];
const BOULDER_NUM_GRADES = ["1","2","3","4","5","6","7","8","9"];
const UIAA_GRADES = ["I","II","III","III+","IV-","IV","IV+","V-","V","V+","VI-","VI","VI+","VII-","VII","VII+","VIII-","VIII","VIII+","IX-","IX","IX+","X-","X","X+","XI-","XI"];
const TENSION_GRADES = ["4a/V0","4b/V0","4c/V0","5a/V1","5b/V1","5c/V2","6a/V3","6a+/V3","6b/V4","6b+/V4","6c/V5","6c+/V5","7a/V6","7a+/V7","7b/V8","7b+/V8","7c/V9","7c+/V10","8a/V11","8a+/V12","8b/V13","8b+/V14","8c/V15","8c+/V16","9a/V17"];

function gradesFor(category, environment) {
  if (category === "lead") return FRENCH_GRADES;
  if (category === "boulder" && environment === "outdoor") return FRENCH_GRADES;
  return BOULDER_NUM_GRADES;
}

// Grade list for the new discipline-based entry flow
function gradesForDiscipline(discipline, environment) {
  if (discipline === "alpin") return UIAA_GRADES;
  if (discipline === "sport") return FRENCH_GRADES;
  if (discipline === "tensionboard") return TENSION_GRADES; // V-scale (Tension app)
  // boulder
  return environment === "outdoor" ? FRENCH_GRADES : BOULDER_NUM_GRADES;
}

function fillGradeSelect(grades, selectedGrade) {
  const sel = document.getElementById("grade");
  if (!sel) return;
  sel.innerHTML = "";
  for (const g of grades) {
    const o = document.createElement("option");
    o.value = g;
    o.textContent = g;
    if (g === selectedGrade) o.selected = true;
    sel.appendChild(o);
  }
  renderGradeChips(sel, grades, selectedGrade || sel.value);
}

// Chip UI mirrors the native #grade select so all existing logic (which reads
// gradeSelect.value / listens for "change") keeps working unchanged.
function renderGradeChips(sel, grades, activeGrade) {
  const box = document.getElementById("gradeChips");
  if (!box) return;
  const active = grades.includes(activeGrade) ? activeGrade : grades[0];
  if (sel.value !== active) sel.value = active;
  box.innerHTML = grades.map(g =>
    `<button type="button" class="grade-chip${g === active ? " active" : ""}" data-grade="${g}">${g}</button>`
  ).join("");
  box.querySelectorAll(".grade-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      sel.value = btn.dataset.grade;
      sel.dispatchEvent(new Event("change"));
      box.querySelectorAll(".grade-chip").forEach(b => b.classList.toggle("active", b === btn));
    });
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- localStorage helpers ----------
function getLastChoice() {
  try {
    return {
      category: localStorage.getItem("ct_cat") || "lead",
      grade: localStorage.getItem("ct_grade") || ""
    };
  } catch { return { category: "lead", grade: "" }; }
}
function saveLastChoice(category, grade) {
  try {
    localStorage.setItem("ct_cat", category);
    localStorage.setItem("ct_grade", grade);
  } catch {}
}

// ---------- Dashboard ----------
async function initDashboard() {
  const [meR, progressR, leaderboardR, goalsR, logR] = await Promise.all([
    api("/api/me"),
    api("/api/progress/me"),
    api("/api/leaderboard/weekly"),
    api("/api/goals/me"),
    api("/api/log/me")
  ]);

  const me = (await meR.json()).me;
  const progressData = await progressR.json();
  const leaderboardData = await leaderboardR.json();
  const goalsData = await goalsR.json();
  const logData = await logR.json();

  // Profile link
  const myProfileBtn = document.getElementById("myProfileBtn");
  if (myProfileBtn && me) myProfileBtn.href = `profile.html?id=${me.id}`;

  // Logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await fetch("/api/logout", { method: "POST" });
      location.href = "login.html";
    };
  }

  // Admin backup
  const backupBtn = document.getElementById("backupBtn");
  if (backupBtn && me && me.is_admin === 1) {
    backupBtn.style.display = "inline-flex";
    backupBtn.onclick = () => { window.location.href = "/api/admin/backup"; };
  }

  // Admin reset
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn && me && me.is_admin === 1) {
    resetBtn.style.display = "inline-flex";
    resetBtn.onclick = async () => {
      if (!confirm("Wirklich ALLE Ziele und ALLE Logbücher von ALLEN Nutzern löschen?")) return;
      const r = await api("/api/admin/reset", { method: "POST" });
      if (r.ok) { location.reload(); }
      else { alert((await r.json()).error || "Reset fehlgeschlagen"); }
    };
  }

  // Quick log form
  initQuickLog();

  // Status card
  renderStatusCard(me, leaderboardData, progressData);

  // Progress
  renderProgress(progressData);

  // Inline goals
  initInlineGoals(goalsData, progressData);

  // Logbook
  renderLogbook(logData);

  // Dehn Streak daily check-in (top of dashboard)
  initDehnDashboard();

  // First-login intro / patch notes popup
  initOnboarding(me);
}

// ---------- Onboarding: first-login intro + patch notes ----------
function initOnboarding(me) {
  if (!me) return;
  if (me.intro_seen === 0) {
    showIntroModal();
    return; // intro takes precedence; patch notes wait until next visit
  }
  api("/api/patch-notes").then(r => r.json()).then(data => {
    if (data.notes && data.notes.length) showPatchModal(data.notes);
  }).catch(() => {});
}

function closeModalEl(overlay) { if (overlay) overlay.remove(); }

function showIntroModal() {
  const html = `
    <div class="modal-overlay" id="introModal">
      <div class="modal modal-lg">
        <h2>Willkommen bei Climb Tracker! 🧗</h2>
        <p class="muted" style="margin-top:6px;">Kurz das Wichtigste:</p>
        <ul class="intro-list">
          <li>${t("<strong>Eintragen:</strong> Logge Begehungen Schritt für Schritt — Indoor/Outdoor, Sport, Boulder, Alpin und <strong>Tension Board</strong>.")}</li>
          <li>${t("<strong>Diese Woche:</strong> Ein wöchentliches Leaderboard bewertet deine Begehungen nach Schwierigkeit.")}</li>
          <li>${t("<strong>Topos:</strong> Durchstöbere Klettergärten, Sektoren und Routen inkl. Karte.")}</li>
          <li>${t("<strong>Dehn Streak:</strong> Optionaler täglicher Dehn-Streak mit Joker-System — im <em>Profil</em> aktivieren, täglich im Dashboard einchecken.")}</li>
          <li>${t("<strong>Profil & Community:</strong> Ziele setzen, Aktivität sehen; Profile aller Nutzer sind einsehbar.")}</li>
        </ul>
        <p class="muted" style="font-size:12px;">Deine Daten werden dauerhaft gespeichert.</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="introDone" type="button">Los geht's!</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  const overlay = document.getElementById("introModal");
  const done = () => { api("/api/me/seen-intro", { method: "POST" }); closeModalEl(overlay); };
  document.getElementById("introDone").addEventListener("click", done);
}

function showPatchModal(notes) {
  const blocks = notes.map(n => `
    <div class="patch-block">
      <div class="patch-head"><strong>${escapeHtml(t(n.title))}</strong> <span class="muted">${escapeHtml(n.date || "")}</span></div>
      <ul class="intro-list">${(n.items || []).map(i => `<li>${escapeHtml(t(i))}</li>`).join("")}</ul>
    </div>`).join("");
  const html = `
    <div class="modal-overlay" id="patchModal">
      <div class="modal modal-lg">
        <h2>Neue Features ✨</h2>
        <p class="muted" style="margin-top:6px;">Was seit deinem letzten Besuch dazugekommen ist:</p>
        ${blocks}
        <div class="modal-actions">
          <button class="btn btn-primary" id="patchDone" type="button">Alles klar</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  const overlay = document.getElementById("patchModal");
  document.getElementById("patchDone").addEventListener("click", () => {
    api("/api/me/seen-patch", { method: "POST" }); closeModalEl(overlay);
  });
}

function initQuickLog() {
  const last = getLastChoice();

  // ---- State ----
  let env = "indoor";
  let discipline = (last.category === "boulder") ? "boulder" : "sport";
  let mode = "lead";          // sport only
  let currentStyle = "";
  let currentAttempts = 2;

  // Crowdsourced location caches
  let crags = [], sectors = [], routes = [];

  // Alpine: partners + interactive pin map
  let users = [], selectedPartners = [];
  let alpinMap = null, alpinMarker = null;

  // ---- Elements ----
  const envHidden    = document.getElementById("env");
  const discHidden   = document.getElementById("discValue");
  const modeHidden   = document.getElementById("modeValue");
  const styleInput   = document.getElementById("styleInput");
  const cragIdEl     = document.getElementById("cragId");
  const sectorIdEl   = document.getElementById("sectorId");
  const routeIdEl    = document.getElementById("routeId");

  const discToggle   = document.getElementById("discToggle");
  const modeField    = document.getElementById("modeField");
  const gradeSelect  = document.getElementById("grade");
  const gradeLabel   = document.getElementById("gradeLabel");
  const styleField   = document.getElementById("styleField");
  const styleBtns    = document.getElementById("styleBtns");
  const styleDesc    = document.getElementById("styleDesc");
  const attField     = document.getElementById("attemptsField");
  const attValue     = document.getElementById("attValue");
  const attInput     = document.getElementById("attInput");
  const locationSec  = document.getElementById("locationSection");
  const sportExtras  = document.getElementById("sportExtras");
  const alpinSection = document.getElementById("alpinSection");
  const tensionSection = document.getElementById("tensionSection");
  const submitBtn    = document.getElementById("submitLog");

  // Tension board angle quick-presets set the number input
  tensionSection?.querySelectorAll("[data-angle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const inp = document.getElementById("board_angle");
      if (inp) inp.value = btn.dataset.angle;
      tensionSection.querySelectorAll("[data-angle]").forEach(b => b.classList.toggle("active", b === btn));
    });
  });

  // ---- Ascent style definitions ----
  const LEAD_STYLES = [
    { key: "os",    label: "OS",    desc: "Onsight — erster Versuch, kein Beta, keine Vorinformation." },
    { key: "flash", label: "Flash", desc: "Flash — erster Versuch mit Beta (Zusehen, Tipps, …)." },
    { key: "rp",    label: "RP",    desc: "Rotpunkt — sauberer Durchstieg nach mehreren Versuchen." },
    { key: "pp",    label: "PP",    desc: "Pinkpoint — wie RP, aber Expressschlingen waren vorgehängt." },
  ];
  const TR_STYLES = [
    { key: "os",    label: "OS",    desc: "Onsight — erster Versuch, kein Beta." },
    { key: "flash", label: "Flash", desc: "Flash — erster Versuch mit Beta." },
    { key: "tr",    label: "TR",    desc: "Toprope — durchgestiegen nach mehreren Versuchen." },
  ];
  const BOULDER_ATTEMPTS = [
    { key: "flash", label: "⚡ Flash" },
    { key: "2", label: "2" }, { key: "3", label: "3" },
    { key: "4", label: "4" }, { key: "5", label: "5" },
    { key: "6", label: "6" }, { key: "7+", label: "7+" },
  ];

  function styleItems() {
    if (discipline === "boulder" || discipline === "tensionboard") return BOULDER_ATTEMPTS;
    if (discipline === "sport") return mode === "toprope" ? TR_STYLES : LEAD_STYLES;
    return []; // alpin → none
  }

  function setAttempts(n) {
    currentAttempts = Math.max(2, n);
    if (attValue) attValue.textContent = currentAttempts;
    if (attInput) attInput.value = currentAttempts;
  }
  document.getElementById("attMinus")?.addEventListener("click", () => setAttempts(currentAttempts - 1));
  document.getElementById("attPlus")?.addEventListener("click", () => setAttempts(currentAttempts + 1));

  // ---- Discipline buttons (depend on environment) ----
  function disciplinesFor(e) {
    return e === "indoor"
      ? [{ key: "sport", label: "Sport" }, { key: "boulder", label: "Boulder" }, { key: "tensionboard", label: "Tension" }]
      : [{ key: "boulder", label: "Boulder" }, { key: "sport", label: "Sport" }, { key: "alpin", label: "Alpin" }];
  }

  function renderDisciplines() {
    const items = disciplinesFor(env);
    if (!items.find(i => i.key === discipline)) discipline = items[0].key;
    discToggle.innerHTML = items.map(i =>
      `<button type="button" class="toggle-btn${discipline === i.key ? " active" : ""}" data-disc="${i.key}">${i.label}</button>`
    ).join("");
    discToggle.querySelectorAll("[data-disc]").forEach(btn => {
      btn.addEventListener("click", () => { discipline = btn.dataset.disc; onDisciplineChange(); });
    });
  }

  // ---- Style buttons ----
  function renderStyleBtns() {
    const items = styleItems();
    if (discipline === "alpin" || !items.length) {
      styleField.style.display = "none";
      attField.style.display = "none";
      if (styleInput) styleInput.value = "";
      return;
    }
    styleField.style.display = "";
    if (!currentStyle || !items.find(i => i.key === currentStyle)) currentStyle = items[0].key;

    styleBtns.innerHTML = items.map(i =>
      `<button type="button" class="style-btn${currentStyle === i.key ? " active" : ""}" data-style="${i.key}">${i.label}</button>`
    ).join("");
    styleBtns.querySelectorAll(".style-btn").forEach(btn => {
      btn.addEventListener("click", () => { currentStyle = btn.dataset.style; renderStyleBtns(); updateSubmitLabel(); });
    });

    // Attempts: sport lead RP/PP, sport toprope TR
    const needsAttempts = discipline === "sport" && ["rp", "pp", "tr"].includes(currentStyle);
    attField.style.display = needsAttempts ? "" : "none";

    // Description (sport only)
    if (discipline === "sport") {
      const found = items.find(s => s.key === currentStyle);
      styleDesc.textContent = found ? found.desc : "";
      styleDesc.style.display = found ? "" : "none";
    } else {
      styleDesc.style.display = "none";
    }
  }

  // ---- Grade ----
  function refreshGrades(keep) {
    fillGradeSelect(gradesForDiscipline(discipline, env), keep || "");
    if (gradeLabel) gradeLabel.textContent = discipline === "alpin" ? "UIAA-Schwierigkeit" : "Schwierigkeit";
  }

  // ---- Location (crag / sector / route) ----
  function cragLabel() {
    if (env === "indoor") return "Halle";
    if (discipline === "boulder") return "Gebiet / Ort";
    return "Klettergarten";
  }
  const showSectorRoute = () => discipline === "sport" && env === "outdoor";
  // Indoor halls share one list (sport + boulder); outdoor crags stay per discipline
  const cragKind = () => (env === "indoor" ? "indoor" : discipline);

  async function loadCrags() {
    crags = [];
    try { crags = (await (await api(`/api/crags?discipline=${cragKind()}`)).json()).crags || []; } catch {}
  }
  async function loadSectors(cragId) {
    sectors = [];
    if (cragId) { try { sectors = (await (await api(`/api/crags/${cragId}/sectors`)).json()).sectors || []; } catch {} }
  }
  async function loadRoutes(sectorId) {
    routes = [];
    if (sectorId) { try { routes = (await (await api(`/api/sectors/${sectorId}/routes`)).json()).routes || []; } catch {} }
  }

  // Generic alphabetical dropdown with a "+ Hinzufügen…" option at the bottom.
  function locField(wrap, opts) {
    if (!wrap) return;
    const { items, placeholder, addPlaceholder, disabled = false, selectedId = "", onPick, onAdd } = opts;
    wrap.innerHTML = `
      <select class="loc-select"${disabled ? " disabled" : ""}>
        <option value="">${placeholder}</option>
        ${items.map(i => `<option value="${i.id}"${String(i.id) === String(selectedId) ? " selected" : ""}>${escapeHtml(i.name)}</option>`).join("")}
        ${disabled ? "" : `<option value="__add__">+ Hinzufügen…</option>`}
      </select>
      <div class="loc-add" style="display:none;">
        <input type="text" placeholder="${addPlaceholder}" maxlength="120" autocomplete="off" />
        <div class="loc-add-btns">
          <button type="button" class="btn btn-primary loc-save">Hinzufügen</button>
          <button type="button" class="btn btn-ghost loc-cancel">Abbrechen</button>
        </div>
      </div>`;
    const sel = wrap.querySelector(".loc-select");
    const addBox = wrap.querySelector(".loc-add");
    const addInput = wrap.querySelector(".loc-add input");
    sel.addEventListener("change", () => {
      if (sel.value === "__add__") { sel.value = ""; addBox.style.display = "block"; addInput.focus(); return; }
      onPick(sel.value);
    });
    wrap.querySelector(".loc-cancel").addEventListener("click", () => { addBox.style.display = "none"; addInput.value = ""; });
    const doSave = async () => {
      const name = addInput.value.trim();
      if (!name) return;
      addInput.disabled = true;
      await onAdd(name);
    };
    wrap.querySelector(".loc-save").addEventListener("click", doSave);
    addInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSave(); } });
  }

  function renderCragSelect() {
    locField(document.getElementById("cragWrap"), {
      items: crags, placeholder: "— wählen —", addPlaceholder: `${cragLabel()} hinzufügen`,
      selectedId: cragIdEl.value,
      onPick: async (id) => {
        cragIdEl.value = id; sectorIdEl.value = ""; routeIdEl.value = "";
        if (showSectorRoute()) { await loadSectors(id || null); renderSectorSelect(); renderRouteSelect(); }
        updateSubmitLabel();
      },
      onAdd: async (name) => {
        const r = await api("/api/crags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, discipline: cragKind() }) });
        if (!r.ok) { alert("Konnte nicht angelegt werden."); return; }
        const c = (await r.json()).crag;
        await loadCrags(); cragIdEl.value = c.id; renderCragSelect();
        if (showSectorRoute()) { sectorIdEl.value = ""; routeIdEl.value = ""; await loadSectors(c.id); renderSectorSelect(); renderRouteSelect(); }
      }
    });
  }

  function renderSectorSelect() {
    const wrap = document.getElementById("sectorWrap"); if (!wrap) return;
    const disabled = !cragIdEl.value;
    locField(wrap, {
      items: sectors, placeholder: disabled ? "erst Klettergarten wählen" : "— wählen —", addPlaceholder: "Sektor hinzufügen",
      disabled, selectedId: sectorIdEl.value,
      onPick: async (id) => { sectorIdEl.value = id; routeIdEl.value = ""; await loadRoutes(id || null); renderRouteSelect(); },
      onAdd: async (name) => {
        const r = await api("/api/sectors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crag_id: Number(cragIdEl.value), name }) });
        if (!r.ok) { alert("Konnte nicht angelegt werden."); return; }
        const s = (await r.json()).sector;
        await loadSectors(cragIdEl.value); sectorIdEl.value = s.id; renderSectorSelect();
        routeIdEl.value = ""; await loadRoutes(s.id); renderRouteSelect();
      }
    });
  }

  function renderRouteSelect() {
    const wrap = document.getElementById("routeWrap"); if (!wrap) return;
    const disabled = !sectorIdEl.value;
    locField(wrap, {
      items: routes, placeholder: disabled ? "erst Sektor wählen" : "— wählen —", addPlaceholder: "Route hinzufügen",
      disabled, selectedId: routeIdEl.value,
      onPick: (id) => {
        routeIdEl.value = id;
        const rt = routes.find(x => String(x.id) === String(id));
        if (rt) {
          if (rt.grade && gradesForDiscipline(discipline, env).includes(rt.grade)) refreshGrades(rt.grade);
          const len = document.getElementById("length_m"); if (len && rt.length_m) len.value = rt.length_m;
          updateSubmitLabel();
        }
      },
      onAdd: async (name) => {
        const r = await api("/api/routes", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ crag_id: Number(cragIdEl.value), sector_id: Number(sectorIdEl.value), name, grade: gradeSelect.value, length_m: document.getElementById("length_m")?.value || null }) });
        if (!r.ok) { alert("Konnte nicht angelegt werden."); return; }
        const rt = (await r.json()).route;
        await loadRoutes(sectorIdEl.value); routeIdEl.value = rt.id; renderRouteSelect();
      }
    });
  }

  // Tension board: only halls that have a Tension Board (activated in the Topos),
  // picking one auto-fills the board angle when the hall has a fixed angle.
  async function buildTensionLocationUI() {
    cragIdEl.value = ""; sectorIdEl.value = ""; routeIdEl.value = "";
    let halls = [];
    try { halls = (await (await api("/api/crags?discipline=indoor&tension=1")).json()).crags || []; } catch {}
    crags = halls;
    locationSec.innerHTML = `
      <div class="field">
        <label>Halle (mit Tension Board) <span class="opt">optional</span></label>
        <select class="loc-select" id="tensionHallSelect">
          <option value="">— wählen —</option>
          ${halls.map(h => `<option value="${h.id}">${escapeHtml(h.name)}${h.tension_angle != null ? ` · ${h.tension_angle}°` : " · variabel"}</option>`).join("")}
        </select>
        <div class="info-box" style="margin-top:8px;">
          <span>ℹ️</span>
          <div>Halle nicht dabei? Du musst das Tension Board der Halle zuerst in den <a href="topo.html">Topos</a> aktivieren.</div>
        </div>
      </div>`;
    const sel = document.getElementById("tensionHallSelect");
    sel.addEventListener("change", () => {
      cragIdEl.value = sel.value || "";
      const hall = halls.find(h => String(h.id) === String(sel.value));
      const angleInput = document.getElementById("board_angle");
      // Fixed-angle board → auto-select the angle; variable board → leave the user's choice
      if (hall && hall.tension_angle != null && angleInput) {
        angleInput.value = hall.tension_angle;
        document.querySelectorAll("#tensionAnglePresets [data-angle]").forEach(b =>
          b.classList.toggle("active", String(b.dataset.angle) === String(hall.tension_angle)));
      }
    });
  }

  async function buildLocationUI() {
    if (discipline === "alpin") { locationSec.innerHTML = ""; return; }
    if (discipline === "tensionboard") { await buildTensionLocationUI(); return; }
    locationSec.innerHTML = `
      <div class="field">
        <label>${cragLabel()} <span class="opt">optional</span></label>
        <div id="cragWrap"></div>
      </div>
      ${showSectorRoute() ? `
      <div class="field"><label>Sektor <span class="opt">optional</span></label><div id="sectorWrap"></div></div>
      <div class="field"><label>Route <span class="opt">optional</span></label><div id="routeWrap"></div></div>` : ""}
    `;
    cragIdEl.value = ""; sectorIdEl.value = ""; routeIdEl.value = "";
    await loadCrags();
    renderCragSelect();
    if (showSectorRoute()) { renderSectorSelect(); renderRouteSelect(); }
  }

  // ---- Alpine section ----
  async function buildAlpinUI() {
    alpinSection.innerHTML = `
      <div class="divider"></div>
      <div class="form">
        <div class="field">
          <label for="tour_name">Tourname</label>
          <input id="tour_name" name="tour_name" maxlength="160" placeholder="z.B. Watzmann Ostwand" />
        </div>
        <div class="grid cols-2" style="gap:12px;">
          <div class="field"><label for="summit">Gipfel</label><input id="summit" name="summit" maxlength="120" placeholder="z.B. Watzmann" /></div>
          <div class="field"><label for="region">Region</label><input id="region" name="region" maxlength="120" placeholder="z.B. Berchtesgaden" /></div>
          <div class="field"><label for="pitches">Seillängen <span class="opt">optional</span></label><input id="pitches" name="pitches" type="number" min="0" inputmode="numeric" /></div>
          <div class="field"><label for="height_m">Höhenmeter <span class="opt">optional</span></label><input id="height_m" name="height_m" type="number" min="0" inputmode="numeric" /></div>
          <div class="field"><label for="climb_date">Datum <span class="opt">optional</span></label><input id="climb_date" name="climb_date" type="date" /></div>
          <div class="field"><label for="time_spent">Zeitaufwand <span class="opt">optional</span></label><input id="time_spent" name="time_spent" maxlength="60" placeholder="z.B. 6 h" /></div>
        </div>
        <div class="field">
          <label for="protection">Absicherung <span class="opt">optional</span></label>
          <select id="protection" name="protection">
            <option value="">—</option>
            <option value="trad">Trad / selbst absichern</option>
            <option value="bolt">Bohrhaken</option>
            <option value="mixed">Gemischt</option>
          </select>
        </div>
        <div class="field"><label for="conditions">Verhältnisse <span class="opt">optional</span></label><textarea id="conditions" name="conditions" rows="2" maxlength="1000" placeholder="Felsqualität, Eis-/Schneelage, Steinschlagrisiko …"></textarea></div>
        <div class="grid cols-2" style="gap:12px;">
          <div class="field"><label for="approach">Zustieg <span class="opt">optional</span></label><textarea id="approach" name="approach" rows="2" maxlength="1000" placeholder="Besonderheiten Zustieg"></textarea></div>
          <div class="field"><label for="descent">Abstieg <span class="opt">optional</span></label><textarea id="descent" name="descent" rows="2" maxlength="1000" placeholder="Besonderheiten Abstieg"></textarea></div>
        </div>
        <div class="field"><label for="beta">Beta <span class="opt">optional</span></label><textarea id="beta" name="beta" rows="3" maxlength="2000" placeholder="Taktik-Tipps, Schlüsselstellen, Routenführung …"></textarea></div>
        <div class="field">
          <label>Kletterpartner <span class="opt">optional</span></label>
          <div class="partner-chips" id="partnerChips"></div>
          <select id="partnerSelect"><option value="">+ Partner hinzufügen…</option></select>
          <input type="hidden" name="partner_ids" id="partnerIds" />
        </div>
        <div class="field">
          <label>Ort auf der Karte <span class="opt">optional</span></label>
          <p class="muted" style="margin:0 0 6px;">Tippe auf die Karte, um die Nadel zu setzen — oder ziehe sie an die richtige Stelle.</p>
          <div id="alpinMap" class="alpin-map"></div>
          <input type="hidden" name="lat" id="latInput" />
          <input type="hidden" name="lng" id="lngInput" />
          <div class="map-actions">
            <button type="button" class="btn btn-ghost" id="useGeo">📍 Mein Standort</button>
            <button type="button" class="btn btn-ghost" id="clearPin">Nadel entfernen</button>
          </div>
        </div>
      </div>
    `;
    // Load community users for the partner picker (excluding myself)
    try {
      const [uRes, meRes] = await Promise.all([api("/api/users"), api("/api/me")]);
      const allUsers = (await uRes.json()).users || [];
      const meId = (await meRes.json()).me?.id;
      users = allUsers.filter(u => String(u.id) !== String(meId));
    } catch {}
    const partnerSelect = document.getElementById("partnerSelect");
    partnerSelect?.addEventListener("change", (e) => {
      const id = e.target.value;
      if (id) {
        const u = users.find(x => String(x.id) === String(id));
        if (u && !selectedPartners.find(p => p.id === u.id)) selectedPartners.push({ id: u.id, username: u.username });
      }
      e.target.value = "";
      renderPartnerSelect(); renderPartnerChips();
    });
    renderPartnerSelect();
    renderPartnerChips();
  }

  function renderPartnerSelect() {
    const sel = document.getElementById("partnerSelect"); if (!sel) return;
    const avail = users.filter(u => !selectedPartners.find(p => p.id === u.id));
    sel.innerHTML = `<option value="">+ Partner hinzufügen…</option>` +
      avail.map(u => `<option value="${u.id}">${escapeHtml(u.username)}</option>`).join("");
  }
  function renderPartnerChips() {
    const box = document.getElementById("partnerChips"); if (!box) return;
    box.innerHTML = selectedPartners.map(p =>
      `<span class="partner-chip">${escapeHtml(p.username)}<button type="button" data-rm="${p.id}" aria-label="entfernen">✕</button></span>`
    ).join("");
    box.querySelectorAll("[data-rm]").forEach(btn => btn.addEventListener("click", () => {
      selectedPartners = selectedPartners.filter(p => String(p.id) !== String(btn.dataset.rm));
      renderPartnerSelect(); renderPartnerChips();
    }));
    const hidden = document.getElementById("partnerIds");
    if (hidden) hidden.value = selectedPartners.map(p => p.id).join(",");
  }

  // Interactive map: click or drag a pin to set the tour location; coords saved as lat/lng.
  function initAlpinMap() {
    const el = document.getElementById("alpinMap");
    if (!el) return;
    if (typeof L === "undefined") { setTimeout(initAlpinMap, 300); return; }
    if (alpinMap) { setTimeout(() => alpinMap.invalidateSize(), 100); return; }
    alpinMap = L.map(el).setView([47.0, 11.0], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(alpinMap);
    const latEl = document.getElementById("latInput"), lngEl = document.getElementById("lngInput");
    function setPin(ll) {
      if (!alpinMarker) {
        alpinMarker = L.marker(ll, { draggable: true }).addTo(alpinMap);
        alpinMarker.on("dragend", () => { const p = alpinMarker.getLatLng(); latEl.value = p.lat.toFixed(6); lngEl.value = p.lng.toFixed(6); });
      } else alpinMarker.setLatLng(ll);
      latEl.value = ll.lat.toFixed(6); lngEl.value = ll.lng.toFixed(6);
    }
    alpinMap.on("click", (e) => setPin(e.latlng));
    document.getElementById("useGeo")?.addEventListener("click", () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(pos => {
        const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
        alpinMap.setView(ll, 13); setPin(ll);
      });
    });
    document.getElementById("clearPin")?.addEventListener("click", () => {
      if (alpinMarker) { alpinMap.removeLayer(alpinMarker); alpinMarker = null; }
      latEl.value = ""; lngEl.value = "";
    });
    setTimeout(() => alpinMap.invalidateSize(), 250);
  }

  // ---- Apply discipline state to the whole form ----
  async function onDisciplineChange() {
    discHidden.value = discipline;
    // toggle buttons active state
    discToggle.querySelectorAll("[data-disc]").forEach(b => b.classList.toggle("active", b.dataset.disc === discipline));

    const isAlpin = discipline === "alpin";
    const isSport = discipline === "sport";
    const isTension = discipline === "tensionboard";

    modeField.style.display = isSport ? "" : "none";
    // Route length + quickdraws only make sense for outdoor sport routes
    sportExtras.style.display = (isSport && env === "outdoor") ? "grid" : "none";
    alpinSection.style.display = isAlpin ? "" : "none";
    if (tensionSection) tensionSection.style.display = isTension ? "grid" : "none";

    currentStyle = "";
    refreshGrades("");
    renderStyleBtns();

    // Location vs alpine fields
    if (isAlpin) {
      locationSec.innerHTML = "";
      if (!alpinSection.dataset.built) { await buildAlpinUI(); alpinSection.dataset.built = "1"; }
      initAlpinMap();
    } else {
      await buildLocationUI();
    }
    updateSubmitLabel();
  }

  // ---- Environment ----
  document.querySelectorAll("#envToggle [data-env]").forEach(btn => {
    btn.addEventListener("click", () => {
      env = btn.dataset.env;
      envHidden.value = env;
      document.querySelectorAll("#envToggle [data-env]").forEach(b => b.classList.toggle("active", b.dataset.env === env));
      renderDisciplines();
      onDisciplineChange();
    });
  });

  // ---- Mode (sport) ----
  document.querySelectorAll("#modeToggle [data-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      mode = btn.dataset.mode;
      modeHidden.value = mode;
      document.querySelectorAll("#modeToggle [data-mode]").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
      currentStyle = "";
      renderStyleBtns();
      updateSubmitLabel();
    });
  });

  // ---- Mobile quick-log FAB ----
  const logCardPanel = document.getElementById("logCardPanel");
  const mobileLogFab = document.getElementById("mobileLogFab");
  const logCardClose = document.getElementById("logCardClose");
  mobileLogFab?.addEventListener("click", () => logCardPanel?.classList.add("open"));
  logCardClose?.addEventListener("click", () => logCardPanel?.classList.remove("open"));

  // ---- Mehr Optionen ----
  const expandLink = document.getElementById("expandExtras");
  const extraFields = document.getElementById("extraFields");
  expandLink?.addEventListener("click", () => {
    extraFields.classList.toggle("visible");
    expandLink.textContent = extraFields.classList.contains("visible") ? "Weniger Optionen" : "Mehr Optionen";
  });

  // ---- Submit label ----
  function updateSubmitLabel() {
    if (!submitBtn) return;
    const T = window.t || ((s) => s);
    const grade = gradeSelect ? gradeSelect.value : "";
    const discLabel = T(discipline === "boulder" ? "Boulder"
      : discipline === "tensionboard" ? "Tension"
      : discipline === "alpin" ? "Alpin"
      : (mode === "toprope" ? "Toprope" : "Sport"));
    const save = T("speichern");
    const stylePart = (discipline === "sport" && currentStyle) ? ` · ${currentStyle.toUpperCase()}` : "";
    if (discipline === "alpin") { submitBtn.textContent = grade ? `${T("Alpin")} ${grade} ${save}` : T("Tour speichern"); return; }
    submitBtn.textContent = grade ? `${discLabel} ${grade}${stylePart} ${save}` : `${discLabel} ${save}`;
  }
  gradeSelect?.addEventListener("change", updateSubmitLabel);

  // ---- Initial render ----
  renderDisciplines();
  onDisciplineChange();
  refreshGrades(last.grade);
  updateSubmitLabel();

  // ---- Submit ----
  const logForm = document.getElementById("logForm");
  logForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    logCardPanel?.classList.remove("open");
    try {
      const fd = new FormData(e.target);
      fd.set("environment", env);
      fd.set("discipline", discipline);
      const grade = fd.get("grade");

      // ascent_style + attempts
      if (discipline === "boulder" || discipline === "tensionboard") {
        if (currentStyle === "flash") { fd.set("ascent_style", "flash"); fd.set("attempts", "1"); }
        else { fd.set("ascent_style", ""); fd.set("attempts", currentStyle === "7+" ? "7" : currentStyle); }
        fd.delete("mode");
      } else if (discipline === "sport") {
        fd.set("mode", mode);
        fd.set("ascent_style", currentStyle || "");
        if (["rp", "pp", "tr"].includes(currentStyle)) fd.set("attempts", String(currentAttempts));
        else fd.set("attempts", "1");
      } else {
        // alpin
        fd.delete("mode"); fd.delete("ascent_style"); fd.delete("attempts");
      }
      // clear empty location ids so they aren't sent as ""
      ["crag_id", "sector_id", "route_id"].forEach(k => { if (!fd.get(k)) fd.delete(k); });

      const r = await api("/api/log/me", { method: "POST", body: new URLSearchParams(fd) });
      if (!r.ok) { alert((await r.json()).error || "Fehler"); return; }

      saveLastChoice((discipline === "boulder" || discipline === "tensionboard") ? "boulder" : "lead", grade);

      // Reset volatile alpine inputs (keep the map instance, just clear the pin)
      if (discipline === "alpin") {
        alpinSection.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach(el => { el.value = ""; });
        document.getElementById("latInput").value = ""; document.getElementById("lngInput").value = "";
        if (alpinMarker && alpinMap) { alpinMap.removeLayer(alpinMarker); alpinMarker = null; }
        selectedPartners = []; renderPartnerSelect(); renderPartnerChips();
      }
      // Clear sport extras so they don't carry over to the next entry
      if (discipline === "sport") {
        const len = document.getElementById("length_m"); if (len) len.value = "";
        const qd = document.getElementById("quickdraws"); if (qd) qd.value = "";
      }
      // Clear the Tension reference (angle stays — usually the same for a session)
      if (discipline === "tensionboard") {
        const ref = document.getElementById("tension_ref"); if (ref) ref.value = "";
      }

      // Reload dashboard data
      const [progressR, leaderboardR, goalsR, logR, meR] = await Promise.all([
        api("/api/progress/me"), api("/api/leaderboard/weekly"),
        api("/api/goals/me"), api("/api/log/me"), api("/api/me")
      ]);
      const progressData = await progressR.json();
      renderStatusCard((await meR.json()).me, await leaderboardR.json(), progressData);
      renderProgress(progressData);
      initInlineGoals(await goalsR.json(), progressData);
      renderLogbook(await logR.json());
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// Render a read-only map with a single pin at the saved coordinates
function renderPinMap(container, lat, lng) {
  if (!container || typeof L === "undefined" || lat == null || lng == null) return;
  container.style.display = "block";
  if (container._map) { setTimeout(() => container._map.invalidateSize(), 100); return; }
  const map = L.map(container, { scrollWheelZoom: false });
  container._map = map;
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18, attribution: "© OpenStreetMap"
  }).addTo(map);
  map.setView([lat, lng], 13);
  L.marker([lat, lng]).addTo(map);
  setTimeout(() => map.invalidateSize(), 200);
}

function renderStatusCard(me, leaderboardData, progressData) {
  const el = document.getElementById("statusCard");
  if (!el) return;

  const rows = leaderboardData.rows || [];
  let rank = "-";
  let score = 0;
  let leadCount = 0;
  let boulderCount = 0;

  if (me) {
    const myRow = rows.find(r => String(r.user_id) === String(me.id));
    if (myRow) {
      rank = rows.indexOf(myRow) + 1;
      score = myRow.score ?? 0;
      leadCount = myRow.lead_count ?? 0;
      boulderCount = myRow.boulder_count ?? 0;
    }
  }

  const progress = progressData.progress || [];
  const achieved = progress.filter(p => Number(p.target) > 0 && Number(p.done) >= Number(p.target)).length;
  const total = progress.filter(p => Number(p.target) > 0).length;
  const pct = total > 0 ? Math.round((achieved / total) * 100) : 0;

  el.innerHTML = `
    <div class="status-grid">
      <div class="status-item">
        <div class="status-value">#${rank}</div>
        <div class="status-label">Platz</div>
      </div>
      <div class="status-item">
        <div class="status-value">${score}</div>
        <div class="status-label">Score</div>
      </div>
      <div class="status-item">
        <div class="status-value">${leadCount}</div>
        <div class="status-label">Lead</div>
      </div>
      <div class="status-item">
        <div class="status-value">${boulderCount}</div>
        <div class="status-label">Boulder</div>
      </div>
    </div>
    ${total > 0 ? `
      <div style="margin-top:10px;">
        <div class="muted">${(window.t || (s=>s))("{a} von {b} Zielen erreicht").replace("{a}", achieved).replace("{b}", total)}</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
      </div>
    ` : `<div class="muted" style="margin-top:8px;">Keine Ziele gesetzt</div>`}
  `;
}

function renderProgress(progressData) {
  const el = document.getElementById("progress");
  if (!el) return;

  const progress = progressData.progress || [];
  if (!progress.length) {
    el.innerHTML = `<div class="empty">Keine Ziele gesetzt.</div>`;
    return;
  }

  el.innerHTML = progress
    .sort((a, b) => {
      const dc = (a.category === "lead" ? 0 : 1) - (b.category === "lead" ? 0 : 1);
      if (dc !== 0) return dc;
      return String(a.grade).localeCompare(String(b.grade), "de");
    })
    .map(p => {
      const done = Number(p.done || 0);
      const target = Number(p.target || 0);
      const ok = target > 0 && done >= target;
      return `
        <div class="kpi">
          <div>
            <strong>${p.category === "lead" ? "LEAD" : "BOULDER"} ${p.grade}</strong>
            <div class="muted">${ok ? "Ziel erreicht" : "in Arbeit"}</div>
          </div>
          <div class="badge">${done}/${target}</div>
        </div>
      `;
    })
    .join("");
}

function fmtDate(s) {
  const d = s ? s.replace("T"," ") : "";
  const m = d.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? `${m[3]}.${m[2]}. ${m[4]}:${m[5]}` : d.slice(0,16);
}

function fmtAscent(e) {
  if (e.discipline === "alpin") return "";
  const STYLE_LABELS = { os: "OS", flash: "⚡ Flash", rp: "RP", pp: "PP", tr: "TR" };
  if (e.category === "boulder") {
    if (e.ascent_style === "flash") return "⚡ Flash";
    if (e.attempts && Number(e.attempts) > 1) return `${e.attempts} Versuche`;
    return "";
  }
  // sport (lead/toprope)
  const label = STYLE_LABELS[e.ascent_style] || "";
  if (["rp", "pp", "tr"].includes(e.ascent_style) && e.attempts > 1) return `${label} / ${e.attempts}V`;
  return label;
}

function parseDetails(e) {
  try { return e.details_json ? JSON.parse(e.details_json) : {}; } catch { return {}; }
}

const PROTECTION_LABELS = { trad: "Trad", bolt: "Bohrhaken", mixed: "Gemischt" };

function alpinDetailHtml(e, det) {
  const rows = [];
  const add = (label, val) => { if (val) rows.push(`<div class="ad-row"><span class="ad-key">${label}</span><span class="ad-val">${val}</span></div>`); };
  add("Tour", det.tour_name ? escapeHtml(det.tour_name) : "");
  add("Gipfel", det.summit ? escapeHtml(det.summit) : "");
  add("Region", det.region ? escapeHtml(det.region) : "");
  add("Seillängen", det.pitches);
  add("Höhenmeter", det.height_m ? `${det.height_m} hm` : "");
  add("Zeitaufwand", det.time_spent ? escapeHtml(det.time_spent) : "");
  add("Datum", det.climb_date ? escapeHtml(det.climb_date) : "");
  add("Absicherung", PROTECTION_LABELS[det.protection] || "");
  add("Verhältnisse", det.conditions ? escapeHtml(det.conditions) : "");
  add("Zustieg", det.approach ? escapeHtml(det.approach) : "");
  add("Abstieg", det.descent ? escapeHtml(det.descent) : "");
  add("Partner", det.partners && det.partners.length ? det.partners.map(p => escapeHtml(p.username)).join(", ") : "");
  const beta = det.beta ? `<div class="ad-beta"><span class="ad-key">Beta</span><div>${escapeHtml(det.beta)}</div></div>` : "";
  const map = (det.lat != null && det.lng != null)
    ? `<div class="ad-gpx"><div class="alpin-map" data-lat="${det.lat}" data-lng="${det.lng}" style="display:none;"></div></div>`
    : "";
  return `<div class="alpin-detail">${rows.join("")}${beta}${map}</div>`;
}

function logCardHtml(e, isSelf) {
  const isOutdoor = e.environment === "outdoor";
  const isAlpin = e.discipline === "alpin";
  const isTR = e.discipline === "sport" && e.mode === "toprope";
  const det = parseDetails(e);
  const isTension = e.discipline === "tensionboard";
  const ascentLabel = fmtAscent(e);
  const typeLabel = isAlpin ? "Alpin"
    : isTension ? "Tension"
    : (e.category === "boulder" ? "Boulder" : (isTR ? "Toprope" : "Lead"));

  // location / context parts
  const locParts = [];
  if (isAlpin) {
    if (det.summit) locParts.push(escapeHtml(det.summit));
    else if (det.tour_name) locParts.push(escapeHtml(det.tour_name));
    if (det.region) locParts.push(escapeHtml(det.region));
  } else {
    if (e.crag_name) locParts.push(escapeHtml(e.crag_name));
    if (e.sector_name) locParts.push(escapeHtml(e.sector_name));
    if (e.route_name) locParts.push(escapeHtml(e.route_name));
  }
  const extras = [];
  if (det.length_m) extras.push(`${det.length_m} m`);
  if (det.quickdraws) extras.push(`${det.quickdraws} Express`);
  if (det.board_angle != null) extras.push(`${det.board_angle}°`);
  if (det.tension_ref) extras.push(`Tension: ${escapeHtml(String(det.tension_ref).slice(0, 60))}`);

  const detailLine = [locParts.join(" · "), fmtDate(e.created_at), ...extras, e.notes ? escapeHtml(e.notes) : ""]
    .filter(Boolean).join(" · ");

  const hasAlpinDetail = isAlpin && (det.beta || det.approach || det.descent || det.conditions ||
    det.protection || det.pitches || det.height_m || det.time_spent || det.climb_date || det.tour_name ||
    (det.partners && det.partners.length) || (det.lat != null && det.lng != null));

  return `
    <div class="log-card-wrap">
      <div class="log-card${hasAlpinDetail ? " log-card-expandable" : ""}" data-entry-id="${e.id}">
        <div class="log-main">
          <div class="log-grade">
            ${typeLabel} ${escapeHtml(String(e.grade))}
            <span class="log-env-badge ${isOutdoor ? 'outdoor' : ''}">${isOutdoor ? 'Outdoor' : 'Indoor'}</span>
            ${ascentLabel ? `<span class="log-ascent-badge">${ascentLabel}</span>` : ""}
            ${hasAlpinDetail ? `<span class="log-detail-toggle" data-toggle="${e.id}">Details ▾</span>` : ""}
          </div>
          <div class="log-detail">${detailLine}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          <div class="log-count">×${e.count}</div>
          ${isSelf ? `<button class="btn-delete-entry" data-id="${e.id}" title="Eintrag löschen">✕</button>` : ""}
        </div>
      </div>
      ${hasAlpinDetail ? alpinDetailHtml(e, det) : ""}
    </div>
  `;
}

// Wire up alpine detail toggles + lazy GPX map loading within a container
function wireAlpinDetails(scope) {
  scope.querySelectorAll(".log-detail-toggle").forEach(tog => {
    tog.addEventListener("click", async () => {
      const id = tog.dataset.toggle;
      const wrap = tog.closest(".log-card-wrap");
      const detail = wrap?.querySelector(".alpin-detail");
      if (!detail) return;
      const open = detail.classList.toggle("open");
      tog.textContent = open ? "Details ▴" : "Details ▾";
      const mapEl = detail.querySelector(".alpin-map[data-lat]");
      if (open && mapEl && !mapEl.dataset.loaded) {
        mapEl.dataset.loaded = "1";
        renderPinMap(mapEl, Number(mapEl.dataset.lat), Number(mapEl.dataset.lng));
      }
    });
  });
}

function renderLogbook(logData) {
  const el = document.getElementById("log");
  if (!el) return;
  const entries = logData.entries || [];
  if (!entries.length) {
    el.innerHTML = `<div class="empty">Noch keine Logbuch-Einträge.</div>`;
    return;
  }
  el.innerHTML = `<div class="log-cards">${entries.map(e => logCardHtml(e)).join("")}</div>`;
  wireAlpinDetails(el);
}

// ---------- Inline Goals ----------
function initInlineGoals(goalsData, progressData) {
  const container = document.getElementById("inlineGoals");
  if (!container) return;

  const current = new Map(goalsData.goals.map(g => [`${g.category}:${g.grade}`, g.target_count]));
  const progressMap = new Map((progressData.progress || []).map(p => [`${p.category}:${p.grade}`, Number(p.done || 0)]));

  let activeCat = "lead";
  let showAll = false;

  function render() {
    const grades = gradesFor(activeCat);
    const activeGoals = grades.filter(g => (current.get(`${activeCat}:${g}`) ?? 0) > 0);
    const displayGrades = showAll ? grades : (activeGoals.length > 0 ? activeGoals : grades);

    container.innerHTML = `
      <div class="toggle-group" style="margin-bottom:10px;">
        <button type="button" class="toggle-btn ${activeCat === 'lead' ? 'active' : ''}" data-gcat="lead">Lead</button>
        <button type="button" class="toggle-btn ${activeCat === 'boulder' ? 'active' : ''}" data-gcat="boulder">Boulder</button>
      </div>
      <div class="goals-grid" id="goalGrid">
        ${displayGrades.map(grade => {
          const key = `${activeCat}:${grade}`;
          const target = current.get(key) ?? 0;
          const done = progressMap.get(key) ?? 0;
          return `
            <div class="goal-row">
              <div style="display:flex;align-items:center;gap:8px;">
                <div class="glabel">${grade}</div>
                ${target > 0 ? `<span class="badge">${done}/${target}</span>` : ''}
              </div>
              <input type="number" min="0" value="${target}" name="${grade}" inputmode="numeric">
            </div>
          `;
        }).join("")}
      </div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap;">
        <button type="button" class="btn btn-primary" id="saveGoalsBtn">${activeCat === 'lead' ? 'Lead' : 'Boulder'} speichern</button>
        <span class="expand-link" id="toggleAllGrades">${showAll ? 'Nur aktive Ziele' : 'Alle Schwierigkeiten'}</span>
      </div>
    `;

    // Tab switch
    container.querySelectorAll("[data-gcat]").forEach(btn => {
      btn.addEventListener("click", () => {
        activeCat = btn.dataset.gcat;
        showAll = false;
        render();
      });
    });

    // Toggle all grades
    const toggleLink = document.getElementById("toggleAllGrades");
    if (toggleLink) {
      toggleLink.addEventListener("click", () => {
        showAll = !showAll;
        render();
      });
    }

    // Save goals
    const saveBtn = document.getElementById("saveGoalsBtn");
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const grid = document.getElementById("goalGrid");
        const goals = [];
        // Include ALL grades for this category, not just displayed ones
        for (const grade of gradesFor(activeCat)) {
          const input = grid.querySelector(`input[name="${grade}"]`);
          const val = input ? Number(input.value) : (current.get(`${activeCat}:${grade}`) ?? 0);
          goals.push({ grade, target_count: val });
        }
        const r = await api("/api/goals/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: activeCat, goals })
        });
        if (r.ok) {
          // Update local state
          for (const g of goals) current.set(`${activeCat}:${g.grade}`, g.target_count);
          // Refresh progress
          const pR = await api("/api/progress/me");
          const pData = await pR.json();
          const newProgressMap = new Map((pData.progress || []).map(p => [`${p.category}:${p.grade}`, Number(p.done || 0)]));
          for (const [k, v] of newProgressMap) progressMap.set(k, v);
          renderProgress(pData);
          const meR = await api("/api/me");
          const lbR = await api("/api/leaderboard/weekly");
          renderStatusCard((await meR.json()).me, await lbR.json(), pData);
          render();
          alert("Gespeichert.");
        } else {
          alert((await r.json()).error || "Fehler beim Speichern");
        }
      });
    }
  }

  render();
}

// ---------- Community (with Leaderboard) ----------
async function initCommunityPage() {
  const [meR, usersR, lbR] = await Promise.all([
    api("/api/me"),
    api("/api/users"),
    api("/api/leaderboard/weekly")
  ]);

  const me = (await meR.json()).me;
  const usersData = await usersR.json();
  const lbData = await lbR.json();

  // Tab switching
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  // Render leaderboard
  const boardEl = document.getElementById("board");
  const rows = lbData.rows || [];
  const startEl = document.getElementById("lbStart");
  if (startEl) startEl.textContent = lbData.startOfWeek;

  const MEDALS = ["🥇","🥈","🥉"];

  if (boardEl) {
    if (!rows.length) {
      boardEl.innerHTML = `<div class="empty">Keine Daten diese Woche.</div>`;
    } else {
      boardEl.innerHTML = `
        <div class="lb-list">
          ${rows.map((u, i) => {
            const isSelf = me && String(u.user_id) === String(me.id);
            const medal = MEDALS[i] || `<span class="lb-rank">${i + 1}</span>`;
            const hasActivity = (u.score ?? 0) > 0;
            return `
              <a class="lb-row${isSelf ? ' lb-self' : ''}" href="profile.html?id=${u.user_id}">
                <div class="lb-left">
                  <span class="lb-medal">${medal}</span>
                  <span class="lb-name">${escapeHtml(u.username)}</span>
                  ${isSelf ? `<span class="lb-you">Du</span>` : ""}
                </div>
                <div class="lb-right">
                  ${hasActivity ? `
                    <span class="lb-stat" title="Score"><strong>${u.score ?? 0}</strong> Pts</span>
                    <span class="lb-stat muted">Lead: ${u.lead_count ?? 0}</span>
                    <span class="lb-stat muted">Boulder: ${u.boulder_count ?? 0}</span>
                  ` : `<span class="muted lb-stat">Keine Einträge</span>`}
                </div>
              </a>
            `;
          }).join("")}
        </div>
      `;
    }
  }

  // Render users
  const usersEl = document.getElementById("users");
  if (usersEl) {
    if (!usersData.users?.length) {
      usersEl.innerHTML = `<div class="empty">Keine Nutzer gefunden.</div>`;
    } else {
      usersEl.innerHTML = usersData.users.map(u => {
        const isSelf = me && String(u.id) === String(me.id);
        return `
          <a class="user-row${isSelf ? ' lb-self' : ''}" href="profile.html?id=${u.id}">
            <div class="user-avatar">${escapeHtml(u.username.slice(0,1).toUpperCase())}</div>
            <div class="user-info">
              <div class="user-name">${escapeHtml(u.username)}${isSelf ? ` <span class="lb-you">Du</span>` : ""}</div>
              ${u.bio ? `<div class="user-bio">${escapeHtml(u.bio.slice(0,60))}${u.bio.length > 60 ? "…" : ""}</div>` : ""}
            </div>
            <span class="pill" style="flex-shrink:0">Profil →</span>
          </a>
        `;
      }).join("");
    }
  }
}

// ---------- Profile ----------
async function initProfile() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id) return;

  const meR = await api("/api/me");
  const me = (await meR.json()).me;
  const isSelf = me && String(me.id) === String(id);
  const isAdmin = me && me.is_admin === 1;

  const profR = await api(`/api/profile/user/${id}`);
  const profData = await profR.json();
  const profileUser = profData.user;

  const subtitle = document.getElementById("subtitle");
  if (subtitle) subtitle.textContent = profileUser ? `Profil: ${profileUser.username}` : `Profil #${id}`;

  const bioText = document.getElementById("bioText");
  if (bioText) {
    const bio = (profileUser?.bio || "").trim();
    bioText.textContent = bio.length ? bio : "Keine Bio gesetzt.";
  }

  const [goalsR, progressR, logR, activityR] = await Promise.all([
    api(`/api/goals/user/${id}`),
    api(`/api/progress/user/${id}`),
    api(`/api/log/user/${id}`),
    api(`/api/activity/user/${id}`)
  ]);
  const goals = (await goalsR.json()).goals;
  const progress = (await progressR.json()).progress || [];
  const log = (await logR.json()).entries;
  const activity = (await activityR.json()).activity || [];

  const doneMap = {};
  for (const p of progress) doneMap[`${p.category}:${p.grade}`] = p.done;

  renderActivityGraph(activity);
  renderUserGoals(goals, doneMap);
  renderUserLog(log, isSelf, id);

  // Dehn Streak (own profile only)
  if (isSelf) initDehnStreak();

  // Self actions
  const selfActions = document.getElementById("selfActions");
  if (selfActions) selfActions.style.display = isSelf ? "block" : "none";

  if (isSelf) {
    const bioEdit = document.getElementById("bioEdit");
    if (bioEdit) bioEdit.style.display = "block";
    const bioInput = document.getElementById("bioInput");
    if (bioInput) bioInput.value = profileUser?.bio || "";

    const saveBioBtn = document.getElementById("saveBioBtn");
    if (saveBioBtn) {
      saveBioBtn.onclick = async () => {
        const bio = document.getElementById("bioInput").value;
        const r = await api("/api/me/bio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bio })
        });
        if (r.ok) { alert("Bio gespeichert."); location.reload(); }
        else { alert((await r.json()).error || "Fehler"); }
      };
    }

    const saveUsername = document.getElementById("saveUsername");
    if (saveUsername) {
      saveUsername.onclick = async () => {
        const username = document.getElementById("newUsername").value;
        const r = await api("/api/me/username", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username })
        });
        if (r.ok) { alert("Username geändert."); location.reload(); }
        else { alert((await r.json()).error || "Fehler"); }
      };
    }

    const savePassword = document.getElementById("savePassword");
    if (savePassword) {
      savePassword.onclick = async () => {
        const oldPassword = document.getElementById("oldPassword").value;
        const newPassword = document.getElementById("newPassword").value;
        const r = await api("/api/me/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldPassword, newPassword })
        });
        if (r.ok) {
          alert("Passwort geändert.");
          document.getElementById("oldPassword").value = "";
          document.getElementById("newPassword").value = "";
        } else { alert((await r.json()).error || "Fehler"); }
      };
    }

    const deleteMe = document.getElementById("deleteMe");
    if (deleteMe) {
      deleteMe.onclick = async () => {
        if (!confirm("Wirklich deinen Account löschen? Das kann nicht rückgängig gemacht werden.")) return;
        const r = await api("/api/me/delete", { method: "POST" });
        if (r.ok) location.href = "register.html";
        else alert((await r.json()).error || "Fehler");
      };
    }
  }

  // Admin: IP addresses (visible to admins on any profile, including their own)
  if (isAdmin) {
    const ipCard = document.getElementById("adminIps");
    if (ipCard) {
      ipCard.style.display = "block";
      try {
        const ipData = await (await api(`/api/admin/user-ips/${id}`)).json();
        renderUserIps(ipData.ips || []);
      } catch {
        const el = document.getElementById("ipList");
        if (el) el.innerHTML = `<div class="empty">Konnte IPs nicht laden.</div>`;
      }
    }
  }

  // Admin actions
  const adminActions = document.getElementById("adminActions");
  const showAdminActions = isAdmin && !isSelf;
  if (adminActions) adminActions.style.display = showAdminActions ? "block" : "none";

  if (showAdminActions) {
    const adminRenameBtn = document.getElementById("adminRename");
    if (adminRenameBtn) {
      adminRenameBtn.onclick = async () => {
        const username = document.getElementById("adminNewUsername").value;
        const r = await api(`/api/admin/rename-user/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username })
        });
        if (r.ok) { alert("Username geändert."); location.reload(); }
        else { alert((await r.json()).error || "Fehler"); }
      };
    }

    const adminDeleteBtn = document.getElementById("adminDelete");
    if (adminDeleteBtn) {
      adminDeleteBtn.onclick = async () => {
        if (!confirm("Wirklich diesen Benutzer löschen? Das kann nicht rückgängig gemacht werden.")) return;
        const r = await api(`/api/admin/delete-user/${id}`, { method: "POST" });
        if (r.ok) location.href = "community.html";
        else alert((await r.json()).error || "Fehler");
      };
    }

    const userResetBtn = document.getElementById("userResetBtn");
    if (userResetBtn) {
      userResetBtn.onclick = async () => {
        if (!confirm("Ziele + Logbuch dieses Benutzers wirklich löschen?")) return;
        const r = await api(`/api/admin/reset-user/${id}`, { method: "POST" });
        if (r.ok) { alert("Benutzer zurückgesetzt."); location.reload(); }
        else { alert((await r.json()).error || "Fehler"); }
      };
    }

    const adminSetPasswordBtn = document.getElementById("adminSetPassword");
    if (adminSetPasswordBtn) {
      adminSetPasswordBtn.onclick = async () => {
        const newPassword = document.getElementById("adminNewPassword").value;
        const r = await api(`/api/admin/reset-password/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword })
        });
        if (r.ok) {
          alert("Passwort gesetzt.");
          document.getElementById("adminNewPassword").value = "";
        } else { alert((await r.json()).error || "Fehler"); }
      };
    }
  }
}

function renderUserIps(ips) {
  const el = document.getElementById("ipList");
  if (!el) return;
  if (!ips.length) {
    el.innerHTML = `<div class="empty">Noch keine IP-Adressen erfasst.</div>`;
    return;
  }
  el.innerHTML = `
    <div class="table-scroll">
      <table class="table">
        <thead><tr><th>IP-Adresse</th><th>Zuletzt</th><th>Zuerst</th><th>Anfragen</th></tr></thead>
        <tbody>
          ${ips.map(r => `
            <tr>
              <td style="font-weight:700;">${escapeHtml(r.ip)}</td>
              <td class="td-date">${fmtDate(r.last_seen)}</td>
              <td class="td-date">${fmtDate(r.first_seen)}</td>
              <td>${r.hits}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderActivityGraph(activity) {
  const el = document.getElementById("activityGraph");
  if (!el) return;

  const CELL = 13;   // px per cell
  const GAP  = 3;    // px gap between cells
  const STEP = CELL + GAP;

  // Build lookup: "YYYY-MM-DD" -> total count
  const map = {};
  for (const r of activity) map[r.day] = Number(r.total);
  const max = Math.max(1, ...Object.values(map));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Rewind to the most recent Monday, then go back 52 full weeks
  const startDay = new Date(today);
  const todayDow = (today.getDay() + 6) % 7; // 0=Mon
  startDay.setDate(today.getDate() - todayDow - 51 * 7);

  const DAY_LABELS  = ["Mo", "", "Mi", "", "Fr", "", "So"];
  const MONTH_NAMES = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

  // Build columns
  const columns = [];
  let cur = new Date(startDay);
  while (cur <= today) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const iso = cur.toISOString().slice(0, 10);
      week.push({ iso, count: map[iso] || 0, past: cur <= today });
      cur.setDate(cur.getDate() + 1);
    }
    columns.push(week);
  }

  function levelFor(count) {
    if (count === 0) return 0;
    if (count <= Math.ceil(max * 0.25)) return 1;
    if (count <= Math.ceil(max * 0.5))  return 2;
    if (count <= Math.ceil(max * 0.75)) return 3;
    return 4;
  }

  const totalClimbs = Object.values(map).reduce((a, b) => a + b, 0);
  const activeDays  = Object.values(map).filter(v => v > 0).length;

  // Month label positions (column index where month first appears)
  const monthMarks = [];
  columns.forEach((week, i) => {
    const m = new Date(week[0].iso).getMonth();
    if (i === 0 || new Date(columns[i-1][0].iso).getMonth() !== m) {
      monthMarks.push({ col: i, label: MONTH_NAMES[m] });
    }
  });

  // Render — single scrollable row with sticky day-labels on left
  el.innerHTML = `
    <div class="activity-summary">${totalClimbs} Routen an ${activeDays} Tagen in den letzten 365 Tagen</div>
    <div class="ag-outer">
      <div class="ag-day-col">
        <div class="ag-month-spacer"></div>
        ${DAY_LABELS.map(n => `<div class="ag-day-label">${n}</div>`).join("")}
      </div>
      <div class="ag-scroll" id="agScroll">
        <div class="ag-inner" style="width:${columns.length * STEP}px">
          <div class="ag-months" style="height:18px; position:relative;">
            ${monthMarks.map(m => `
              <span class="ag-month-label" style="left:${m.col * STEP}px">${m.label}</span>
            `).join("")}
          </div>
          <div class="ag-grid">
            ${columns.map(week => `
              <div class="ag-col">
                ${week.map(day => `
                  <div class="ag-cell level-${day.past ? levelFor(day.count) : 0}"
                       title="${day.iso}${day.count ? ': ' + day.count + ' Routen' : ''}"></div>
                `).join("")}
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    </div>
    <div class="ag-legend">
      <span class="muted">Weniger</span>
      ${[0,1,2,3,4].map(l => `<div class="ag-cell level-${l}"></div>`).join("")}
      <span class="muted">Mehr</span>
    </div>
  `;

  // Auto-scroll to the right (most recent weeks)
  const scroller = document.getElementById("agScroll");
  if (scroller) scroller.scrollLeft = scroller.scrollWidth;
}

function renderUserGoals(goals, doneMap = {}) {
  const el = document.getElementById("goals");
  if (!el) return;

  if (!goals || !goals.length) {
    el.innerHTML = `<div class="empty">Keine Ziele.</div>`;
    return;
  }

  const lead = goals.filter(g => g.category === "lead")
    .sort((a, b) => String(a.grade).localeCompare(String(b.grade), "de"));
  const boulder = goals.filter(g => g.category === "boulder")
    .sort((a, b) => String(a.grade).localeCompare(String(b.grade), "de"));

  function goalRow(g) {
    const done = doneMap[`${g.category}:${g.grade}`] || 0;
    const pct = Math.min(100, Math.round((done / g.target_count) * 100));
    const badgeClass = done >= g.target_count ? "badge badge-success" : "badge";
    return `
      <div class="kpi">
        <div><strong>${g.grade}</strong><div class="muted">Fortschritt</div></div>
        <div class="${badgeClass}">${done}/${g.target_count}</div>
      </div>
      <div class="progress-bar" style="margin:-6px 0 6px;"><div class="progress-fill" style="width:${pct}%"></div></div>
    `;
  }

  el.innerHTML = `
    <div class="list">
      <div class="badge">Lead</div>
      ${lead.length ? lead.map(goalRow).join("") : `<div class="empty">Keine Lead Ziele.</div>`}
      <div class="divider"></div>
      <div class="badge">Boulder</div>
      ${boulder.length ? boulder.map(goalRow).join("") : `<div class="empty">Keine Boulder Ziele.</div>`}
    </div>
  `;
}

function renderUserLog(entries, isSelf, userId) {
  const el = document.getElementById("log");
  if (!el) return;

  if (!entries || !entries.length) {
    el.innerHTML = `<div class="empty">Keine Logbuch-Einträge.</div>`;
    return;
  }

  const LIMIT = 10;
  const shown = entries.slice(0, LIMIT);
  const more = entries.length > LIMIT;
  const allBtn = (userId != null)
    ? `<a class="btn btn-ghost" href="logs.html?id=${userId}" style="margin-top:12px;">Alle anzeigen →</a>`
    : "";

  el.innerHTML = `<div class="log-cards">${shown.map(e => logCardHtml(e, isSelf)).join("")}</div>${more ? allBtn : ""}`;
  wireAlpinDetails(el);
  if (isSelf) wireLogDelete(el);
}

// Two-step delete wiring for log cards (own entries only)
function wireLogDelete(el) {
  el.querySelectorAll(".btn-delete-entry").forEach(btn => {
    let confirming = false;
    let resetTimer = null;
    btn.addEventListener("click", async () => {
      if (!confirming) {
        confirming = true;
        btn.textContent = "Löschen?";
        btn.classList.add("btn-delete-confirm");
        resetTimer = setTimeout(() => {
          confirming = false;
          btn.textContent = "✕";
          btn.classList.remove("btn-delete-confirm");
        }, 3000);
        return;
      }
      clearTimeout(resetTimer);
      const id = btn.dataset.id;
      const r = await api(`/api/log/me/${id}`, { method: "DELETE" });
      if (r.ok) {
        const card = el.querySelector(`.log-card[data-entry-id="${id}"]`);
        const wrap = card ? card.closest(".log-card-wrap") : null;
        if (wrap) wrap.remove(); else if (card) card.remove();
        if (!el.querySelector(".log-card")) {
          el.innerHTML = `<div class="empty">Keine Logbuch-Einträge.</div>`;
        }
      } else {
        confirming = false;
        btn.textContent = "✕";
        btn.classList.remove("btn-delete-confirm");
        alert((await r.json()).error || "Fehler beim Löschen");
      }
    });
  });
}

// ---------- Full log page (all entries of a user; viewable by anyone) ----------
async function initFullLog() {
  const id = new URLSearchParams(location.search).get("id");
  const el = document.getElementById("log");
  if (!id || !el) return;

  const me = (await (await api("/api/me")).json()).me;
  const isSelf = me && String(me.id) === String(id);

  let username = "";
  try { username = (await (await api(`/api/profile/user/${id}`)).json()).user?.username || ""; } catch {}
  const titleEl = document.getElementById("logTitle");
  if (titleEl) titleEl.textContent = username ? `Logbuch: ${username}` : "Logbuch";

  const entries = ((await (await api(`/api/log/user/${id}?all=1`)).json()).entries) || [];
  const subEl = document.getElementById("logSub");
  if (subEl) subEl.textContent = `${entries.length} ${entries.length === 1 ? "Eintrag" : "Einträge"} insgesamt`;

  if (!entries.length) { el.innerHTML = `<div class="empty">Keine Logbuch-Einträge.</div>`; return; }
  el.innerHTML = `<div class="log-cards">${entries.map(e => logCardHtml(e, isSelf)).join("")}</div>`;
  wireAlpinDetails(el);
  if (isSelf) wireLogDelete(el);
}

// ---------- Topo (browseable crag/sector/route directory) ----------
const TOPO_DISC_LABELS = { sport: "Klettergärten", boulder: "Boulder-Gebiete", indoor: "Hallen", alpin: "Alpin" };

async function initTopo() {
  const root = document.getElementById("topoRoot");
  if (!root) return;
  const params = new URLSearchParams(location.search);
  const cragId = params.get("crag");
  const tourId = params.get("tour");
  if (cragId) return initTopoDetail(root, cragId);
  if (tourId) return initTopoTourDetail(root, tourId);
  return initTopoList(root);
}

async function initTopoList(root) {
  root.innerHTML = `
    <div class="card">
      <h1>Topos</h1>
      <p class="muted">Alle bekannten Klettergärten, Sektoren, Routen und Alpin-Touren – inkl. Länge, Bemerkungen und Karte.</p>
      <div class="divider"></div>
      <input id="topoSearch" placeholder="Suchen…" autocomplete="off" />
      <div id="topoGroups" style="margin-top:14px;">Lädt…</div>
    </div>`;

  let crags = [], tours = [];
  try { crags = (await (await api("/api/topo/crags")).json()).crags || []; } catch {}
  try { tours = (await (await api("/api/topo/tours")).json()).tours || []; } catch {}
  const groupsEl = document.getElementById("topoGroups");

  function render(filter) {
    const f = (filter || "").trim().toLowerCase();
    const shownCrags = crags.filter(c => !f || c.name.toLowerCase().includes(f));
    const shownTours = tours.filter(t => !f || t.name.toLowerCase().includes(f)
      || (t.region && t.region.toLowerCase().includes(f)));
    if (!shownCrags.length && !shownTours.length) { groupsEl.innerHTML = `<div class="empty">Nichts gefunden.</div>`; return; }

    const order = ["sport", "boulder", "indoor"];
    let html = order.filter(d => shownCrags.some(c => c.discipline === d)).map(d => `
      <div style="margin-bottom:16px;">
        <div class="badge" style="margin-bottom:8px;">${TOPO_DISC_LABELS[d] || d}</div>
        <div class="user-list">
          ${shownCrags.filter(c => c.discipline === d).map(c => `
            <a class="user-row" href="topo.html?crag=${c.id}">
              <div class="user-info">
                <div class="user-name">${escapeHtml(c.name)} ${(c.lat != null && c.lng != null) ? '<span title="Position bekannt">📍</span>' : ''}</div>
                <div class="user-bio">${c.sector_count} Sektoren · ${c.route_count} Routen</div>
              </div>
              <span class="pill" style="flex-shrink:0">Ansehen →</span>
            </a>`).join("")}
        </div>
      </div>`).join("");

    if (shownTours.length) {
      html += `
        <div style="margin-bottom:16px;">
          <div class="badge" style="margin-bottom:8px;">Alpin-Touren</div>
          <div class="user-list">
            ${shownTours.map(t => `
              <a class="user-row" href="topo.html?tour=${t.id}">
                <div class="user-info">
                  <div class="user-name">${escapeHtml(t.name)} ${(t.lat != null && t.lng != null) ? '<span title="Position bekannt">📍</span>' : ''}</div>
                  <div class="user-bio">${[t.grade ? escapeHtml(t.grade) : "", t.region ? escapeHtml(t.region) : "", `${t.climbers} Begeher`].filter(Boolean).join(" · ")}</div>
                </div>
                <span class="pill" style="flex-shrink:0">Ansehen →</span>
              </a>`).join("")}
          </div>
        </div>`;
    }
    groupsEl.innerHTML = html;
  }
  render("");
  document.getElementById("topoSearch")?.addEventListener("input", e => render(e.target.value));
}

async function initTopoTourDetail(root, tourId) {
  let data;
  try { data = await (await api(`/api/topo/tour/${tourId}`)).json(); } catch {}
  if (!data || !data.tour) {
    root.innerHTML = `<div class="card"><a class="expand-link" href="topo.html">← Alle Topos</a><div class="empty" style="margin-top:12px;">Tour nicht gefunden.</div></div>`;
    return;
  }
  const t = data.tour;
  const PROT = { trad: "Trad / selbst absichern", bolt: "Bohrhaken", mixed: "Gemischt" };
  const infoRow = (label, val) => val ? `<div class="ad-row"><span class="ad-key">${label}</span><span class="ad-val">${val}</span></div>` : "";

  root.innerHTML = `
    <div class="card" style="margin-bottom:12px;">
      <a class="expand-link" href="topo.html">← Alle Topos</a>
      <h1 style="margin-top:8px;">${escapeHtml(t.name)} <span class="badge">Alpin</span></h1>
    </div>

    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <h2>Infos</h2>
        <button type="button" class="btn btn-ghost" id="tourEditBtn" style="width:auto;">Bearbeiten</button>
      </div>
      <div class="divider"></div>
      <div id="tourInfoView">
        ${[
          infoRow("Gipfel", t.summit ? escapeHtml(t.summit) : ""),
          infoRow("Region", t.region ? escapeHtml(t.region) : ""),
          infoRow("Schwierigkeit", t.grade ? escapeHtml(t.grade) : ""),
          infoRow("Höhenmeter", t.height_m ? `${t.height_m} hm` : ""),
          infoRow("Absicherung", PROT[t.protection] || ""),
        ].join("") || `<div class="muted">Noch keine Infos — mit „Bearbeiten" ergänzen.</div>`}
        ${t.beta ? `<div class="ad-beta"><span class="ad-key">Beta</span><div>${escapeHtml(t.beta)}</div></div>` : ""}
      </div>
      <div id="tourInfoEdit" style="display:none;"></div>
    </div>

    ${(t.lat != null && t.lng != null) ? `
    <div class="card" style="margin-bottom:12px;">
      <h2>Position</h2>
      <div class="divider"></div>
      <div id="tourMap" class="alpin-map"></div>
    </div>` : ""}

    <div class="card">
      <h2>Begehungen (${data.climbers.length})</h2>
      <p class="muted">Wer diese Tour bereits eingetragen hat.</p>
      <div class="divider"></div>
      ${data.climbers.length ? `<div class="list">${data.climbers.map((c, i) => `
        <a class="lb-row" href="profile.html?id=${c.user_id}">
          <div class="lb-left">
            <span class="lb-medal">${(c.user_id === data.first_logger_id) ? "🥇" : `<span class="lb-rank">${i + 1}</span>`}</span>
            <span class="lb-name">${escapeHtml(c.username)}</span>
            ${(c.user_id === data.first_logger_id) ? `<span class="lb-you">Ersteintrag</span>` : ""}
          </div>
          <span class="lb-stat muted">${fmtDate(c.date)}</span>
        </a>`).join("")}</div>` : `<div class="empty">Noch keine Begehungen erfasst.</div>`}
    </div>`;

  if (t.lat != null && t.lng != null) {
    const mapEl = document.getElementById("tourMap");
    setTimeout(() => renderPinMap(mapEl, Number(t.lat), Number(t.lng)), 150);
  }
  setupTourEdit(t, tourId);
}

function setupTourEdit(t, tourId) {
  const btn = document.getElementById("tourEditBtn");
  const view = document.getElementById("tourInfoView");
  const edit = document.getElementById("tourInfoEdit");
  if (!btn) return;
  const opt = (v, cur) => `<option value="${v}"${v === cur ? " selected" : ""}>${v}</option>`;
  const protSel = (cur) => ["", "trad", "bolt", "mixed"].map(v =>
    `<option value="${v}"${v === (cur || "") ? " selected" : ""}>${{ "": "—", trad: "Trad / selbst absichern", bolt: "Bohrhaken", mixed: "Gemischt" }[v]}</option>`).join("");

  btn.addEventListener("click", () => {
    const open = edit.style.display === "none";
    if (!open) { edit.style.display = "none"; view.style.display = "block"; btn.textContent = "Bearbeiten"; return; }
    view.style.display = "none"; edit.style.display = "block"; btn.textContent = "Schließen";
    edit.innerHTML = `
      <div class="form">
        <div class="grid cols-2" style="gap:12px;">
          <div class="field"><label>Gipfel</label><input id="teSummit" maxlength="120" value="${t.summit ? escapeHtml(t.summit) : ""}"></div>
          <div class="field"><label>Region</label><input id="teRegion" maxlength="120" value="${t.region ? escapeHtml(t.region) : ""}"></div>
          <div class="field"><label>UIAA-Schwierigkeit</label><select id="teGrade"><option value="">—</option>${UIAA_GRADES.map(g => opt(g, t.grade)).join("")}</select></div>
          <div class="field"><label>Höhenmeter</label><input id="teHeight" type="number" min="0" inputmode="numeric" value="${t.height_m != null ? t.height_m : ""}"></div>
        </div>
        <div class="field"><label>Absicherung</label><select id="teProt">${protSel(t.protection)}</select></div>
        <div class="field"><label>Beta</label><textarea id="teBeta" rows="3" maxlength="2000">${t.beta ? escapeHtml(t.beta) : ""}</textarea></div>
        <div class="field">
          <label>Position (auf die Karte tippen)</label>
          <div id="teMap" class="alpin-map"></div>
          <input type="hidden" id="teLat" value="${t.lat != null ? t.lat : ""}"><input type="hidden" id="teLng" value="${t.lng != null ? t.lng : ""}">
        </div>
        <button type="button" class="btn btn-primary" id="teSave">Speichern</button>
      </div>`;
    setupTourEditMap(t);
    document.getElementById("teSave").addEventListener("click", async () => {
      const body = {
        summit: document.getElementById("teSummit").value,
        region: document.getElementById("teRegion").value,
        grade: document.getElementById("teGrade").value,
        height_m: document.getElementById("teHeight").value,
        protection: document.getElementById("teProt").value,
        beta: document.getElementById("teBeta").value,
        lat: document.getElementById("teLat").value || null,
        lng: document.getElementById("teLng").value || null
      };
      const r = await api(`/api/topo/tour/${tourId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) { alert("Gespeichert."); location.reload(); }
      else alert((await r.json()).error || "Fehler");
    });
  });
}

function setupTourEditMap(t) {
  const el = document.getElementById("teMap");
  if (!el || typeof L === "undefined") { setTimeout(() => setupTourEditMap(t), 300); return; }
  const start = (t.lat != null && t.lng != null) ? [t.lat, t.lng] : [47.0, 11.0];
  const map = L.map(el).setView(start, (t.lat != null) ? 12 : 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);
  let marker = (t.lat != null && t.lng != null) ? L.marker(start, { draggable: true }).addTo(map) : null;
  const setLL = (ll) => { document.getElementById("teLat").value = ll.lat.toFixed(6); document.getElementById("teLng").value = ll.lng.toFixed(6); };
  if (marker) marker.on("dragend", () => setLL(marker.getLatLng()));
  map.on("click", (e) => {
    if (!marker) { marker = L.marker(e.latlng, { draggable: true }).addTo(map); marker.on("dragend", () => setLL(marker.getLatLng())); }
    else marker.setLatLng(e.latlng);
    setLL(e.latlng);
  });
  setTimeout(() => map.invalidateSize(), 200);
}

async function initTopoDetail(root, cragId) {
  let data;
  try { data = await (await api(`/api/topo/crag/${cragId}`)).json(); } catch {}
  if (!data || !data.crag) {
    root.innerHTML = `<div class="card"><a class="expand-link" href="topo.html">← Alle Topos</a><div class="empty" style="margin-top:12px;">Klettergarten nicht gefunden.</div></div>`;
    return;
  }
  const c = data.crag;
  const sectorsHtml = data.sectors.map(topoSectorHtml).join("");
  const looseHtml = data.looseRoutes.length ? topoSectorHtml({ id: "none", name: "Ohne Sektor", routes: data.looseRoutes }) : "";
  const hasRoutes = data.sectors.some(s => s.routes.length) || data.looseRoutes.length;

  root.innerHTML = `
    <div class="card" style="margin-bottom:12px;">
      <a class="expand-link" href="topo.html">← Alle Topos</a>
      <h1 style="margin-top:8px;">${escapeHtml(c.name)} <span class="badge">${TOPO_DISC_LABELS[c.discipline] || c.discipline}</span></h1>
    </div>
    <div class="card" style="margin-bottom:12px;">
      <h2>Position</h2>
      <p class="muted" id="topoMapHint"></p>
      <div class="divider"></div>
      <div id="topoMap" class="alpin-map"></div>
      <div class="map-actions">
        <button type="button" class="btn btn-ghost" id="topoEditPos">Position bearbeiten</button>
        <button type="button" class="btn btn-primary" id="topoSavePos" style="display:none;">Position speichern</button>
      </div>
    </div>
    ${c.discipline === "indoor" ? topoTensionHtml(c) : ""}
    ${c.discipline === "indoor" ? "" : `
    <div class="card">
      <h2>Sektoren & Routen</h2>
      <div class="divider"></div>
      ${hasRoutes ? sectorsHtml + looseHtml : `<div class="empty">Noch keine Sektoren/Routen erfasst.</div>`}
    </div>`}`;

  wireTopoCollapsibles(root);
  setupTopoMap(c, cragId);
  if (c.discipline === "indoor") setupTopoTension(c, cragId);
}

function topoTensionHtml(c) {
  const on = c.tension_available === 1;
  const variable = on && (c.tension_angle == null);
  const angleVal = (on && c.tension_angle != null) ? c.tension_angle : "";
  return `
    <div class="card" id="topoTensionCard" style="margin-bottom:12px;">
      <h2>Tension Board</h2>
      <p class="muted">Gibt es in dieser Halle ein Tension Board? Dann kann man beim Loggen die Halle wählen und der Winkel wird automatisch gesetzt.</p>
      <div class="divider"></div>
      <label class="switch-row" for="topoTensionToggle">
        <span><strong style="font-size:15px;">Tension Board vorhanden</strong></span>
        <span class="switch"><input type="checkbox" id="topoTensionToggle" ${on ? "checked" : ""}><span class="slider"></span></span>
      </label>
      <div id="topoTensionAngleWrap" style="display:${on ? "block" : "none"}; margin-top:12px;">
        <label class="remember-label" style="margin-bottom:10px;">
          <input type="checkbox" id="topoTensionVariable" ${variable ? "checked" : ""}> Variabler Winkel (verstellbares Board)
        </label>
        <div class="field" id="topoTensionAngleField" style="display:${variable ? "none" : "grid"};">
          <label>Board-Winkel</label>
          <div class="style-btns" id="topoTensionPresets">
            <button type="button" class="style-btn" data-angle="20">20°</button>
            <button type="button" class="style-btn" data-angle="40">40°</button>
          </div>
          <input type="number" id="topoTensionAngle" min="0" max="90" inputmode="numeric" placeholder="Winkel in °" value="${angleVal}">
        </div>
      </div>
      <button type="button" class="btn btn-primary" id="topoTensionSave" style="margin-top:14px;">Speichern</button>
    </div>`;
}

function setupTopoTension(c, cragId) {
  const toggle = document.getElementById("topoTensionToggle");
  const wrap = document.getElementById("topoTensionAngleWrap");
  const variable = document.getElementById("topoTensionVariable");
  const angleField = document.getElementById("topoTensionAngleField");
  const angleInput = document.getElementById("topoTensionAngle");
  const saveBtn = document.getElementById("topoTensionSave");
  if (!toggle) return;

  toggle.addEventListener("change", () => { wrap.style.display = toggle.checked ? "block" : "none"; });
  variable.addEventListener("change", () => { angleField.style.display = variable.checked ? "none" : "grid"; });
  document.querySelectorAll("#topoTensionPresets [data-angle]").forEach(b => {
    b.addEventListener("click", () => {
      angleInput.value = b.dataset.angle;
      document.querySelectorAll("#topoTensionPresets [data-angle]").forEach(x => x.classList.toggle("active", x === b));
    });
  });

  saveBtn.addEventListener("click", async () => {
    const available = toggle.checked ? 1 : 0;
    let angle = null;
    if (available && !variable.checked) {
      const v = parseInt(angleInput.value, 10);
      if (!isNaN(v)) angle = Math.max(0, Math.min(90, v));
    }
    const body = { available, angle: (available && variable.checked) ? "variable" : angle };
    const r = await api(`/api/crags/${cragId}/tension`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    if (r.ok) { alert("Gespeichert."); location.reload(); }
    else alert((await r.json()).error || "Fehler");
  });
}

function topoSectorHtml(s) {
  return `
    <div class="topo-sector">
      <div class="collapsible-header topo-sec-head open">
        <h2 style="font-size:14px; margin:0;">${escapeHtml(s.name)} <span class="muted">(${s.routes.length})</span></h2>
        <span class="chevron">▾</span>
      </div>
      <div class="collapsible-body open">
        ${s.routes.length ? `<div class="list" style="margin:8px 0 4px;">${s.routes.map(topoRouteHtml).join("")}</div>` : `<div class="empty">Keine Routen.</div>`}
      </div>
    </div>`;
}

function topoRouteHtml(r) {
  const bits = [];
  if (r.length_m) bits.push(`${r.length_m} m`);
  if (r.ascents) bits.push(`${r.ascents} Beg. · ${r.climbers} Kletterer`);
  const remarks = r.remarks || [];
  return `
    <div class="topo-route">
      <div class="kpi">
        <div style="min-width:0;">
          <strong>${escapeHtml(r.name)}</strong>
          <div class="muted">${bits.join(" · ") || "—"}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          ${r.grade ? `<span class="badge">${escapeHtml(String(r.grade))}</span>` : ''}
          ${remarks.length ? `<span class="log-detail-toggle" data-remarks-toggle="${r.id}">${remarks.length} 💬</span>` : ''}
        </div>
      </div>
      ${remarks.length ? `<div class="topo-remarks" id="rem-${r.id}" style="display:none;">
        ${remarks.map(rm => `<div class="topo-remark"><span class="ad-key">${escapeHtml(rm.username)}</span> <span class="td-date">${fmtDate(rm.created_at)}</span><div>${escapeHtml(rm.notes)}</div></div>`).join("")}
      </div>` : ''}
    </div>`;
}

function wireTopoCollapsibles(scope) {
  scope.querySelectorAll(".topo-sec-head").forEach(h => {
    h.addEventListener("click", () => {
      h.classList.toggle("open");
      const body = h.nextElementSibling;
      if (body) body.classList.toggle("open");
    });
  });
  scope.querySelectorAll("[data-remarks-toggle]").forEach(t => {
    t.addEventListener("click", (e) => {
      e.stopPropagation();
      const box = document.getElementById("rem-" + t.dataset.remarksToggle);
      if (box) box.style.display = box.style.display === "none" ? "block" : "none";
    });
  });
}

function setupTopoMap(c, cragId) {
  const mapEl = document.getElementById("topoMap");
  const hint = document.getElementById("topoMapHint");
  const editBtn = document.getElementById("topoEditPos");
  const saveBtn = document.getElementById("topoSavePos");
  if (!mapEl) return;
  const has = c.lat != null && c.lng != null;
  let map = null, marker = null, editing = false, picked = null;

  function ensureMap(center, zoom) {
    if (typeof L === "undefined") { setTimeout(() => ensureMap(center, zoom), 300); return; }
    if (map) return;
    map = L.map(mapEl).setView(center, zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);
    if (has) marker = L.marker([c.lat, c.lng]).addTo(map);
    map.on("click", (e) => {
      if (!editing) return;
      picked = e.latlng;
      if (!marker) { marker = L.marker(e.latlng, { draggable: true }).addTo(map); marker.on("dragend", () => { picked = marker.getLatLng(); }); }
      else marker.setLatLng(e.latlng);
    });
    setTimeout(() => map.invalidateSize(), 200);
  }

  if (has) { hint.textContent = "Bekannte Position dieses Klettergartens."; ensureMap([c.lat, c.lng], 13); }
  else { hint.textContent = "Noch keine Position. Klicke „Position bearbeiten“ und tippe auf die Karte."; ensureMap([47.0, 11.0], 6); }

  editBtn.addEventListener("click", () => {
    editing = !editing;
    editBtn.textContent = editing ? "Abbrechen" : "Position bearbeiten";
    saveBtn.style.display = editing ? "" : "none";
    hint.textContent = editing
      ? "Tippe auf die Karte, um die Nadel zu setzen (oder ziehe sie)."
      : (has ? "Bekannte Position dieses Klettergartens." : "Noch keine Position gesetzt.");
  });

  saveBtn.addEventListener("click", async () => {
    const ll = picked || (marker ? marker.getLatLng() : null);
    if (!ll) { alert("Bitte zuerst eine Position auf der Karte setzen."); return; }
    const r = await api(`/api/crags/${cragId}/location`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: ll.lat, lng: ll.lng })
    });
    if (r.ok) { alert("Position gespeichert."); location.reload(); }
    else alert((await r.json()).error || "Fehler");
  });
}

// ---------- Dehn Streak (stretching streak) ----------
// Profile widget: read-only stats (check-in happens on the dashboard)
function renderDehnWidget(s) {
  const el = document.getElementById("dehnStreakBody");
  if (!el) return;
  el.innerHTML = `
    <div class="status-grid">
      <div class="status-item">
        <div class="status-value">${s.current_streak}</div>
        <div class="status-label">🔥 Aktueller Streak</div>
      </div>
      <div class="status-item">
        <div class="status-value">${s.longest_streak}</div>
        <div class="status-label">📅 Längster</div>
      </div>
      <div class="status-item">
        <div class="status-value">${s.jokers_remaining}/${s.jokers_per_month}</div>
        <div class="status-label">🃏 Joker übrig</div>
      </div>
    </div>
    <p class="muted" style="margin-top:12px;">
      ${s.checked_in_today ? "Heute schon gedehnt ✅" : "Heute noch nicht eingecheckt — Einchecken geht im Dashboard."}
    </p>
  `;
}

// Dashboard daily check-in card (only when enabled & not yet checked in today)
async function initDehnDashboard() {
  const host = document.getElementById("dehnCheckinCard");
  if (!host) return;
  let s;
  try { s = (await (await api("/api/me/dehn-streak")).json()).streak; } catch { return; }
  if (!s.enabled || s.checked_in_today) { host.innerHTML = ""; return; }
  renderDehnPrompt(host, s);
}

function renderDehnPrompt(host, s) {
  const days = s.current_streak === 1 ? "Tag" : "Tage";
  host.innerHTML = `
    <div class="card dehn-prompt" style="margin-bottom:12px;">
      <div class="dehn-prompt-row">
        <div>
          <h2>🔥 Dehn Streak</h2>
          <p class="muted">Heute schon gedehnt? Aktueller Streak: ${s.current_streak} ${days}.</p>
        </div>
        <button class="btn btn-primary" id="dehnDashCheckin">Heute gedehnt!</button>
      </div>
    </div>`;
  const btn = document.getElementById("dehnDashCheckin");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const r = await api("/api/me/dehn-streak/checkin", { method: "POST" });
    if (!r.ok) { host.innerHTML = ""; return; } // e.g. already checked in elsewhere
    const ns = (await r.json()).streak;
    renderDehnDone(host, ns);
  });
}

function renderDehnDone(host, s) {
  const days = s.current_streak === 1 ? "Tag" : "Tage";
  host.innerHTML = `
    <div class="card dehn-prompt dehn-done" style="margin-bottom:12px;">
      <div class="dehn-prompt-row">
        <div>
          <h2>✅ Heute gedehnt!</h2>
          <p class="muted">🔥 ${s.current_streak} ${days} Streak · bis morgen!</p>
        </div>
      </div>
    </div>`;
  // Disappear ~1 minute after checking in; reappears next day on reload
  setTimeout(() => {
    const card = host.querySelector(".card");
    if (!card) return;
    card.style.transition = "opacity 0.5s ease";
    card.style.opacity = "0";
    setTimeout(() => { host.innerHTML = ""; }, 500);
  }, 60000);
}

function initDehnStreak() {
  const settingsCard = document.getElementById("dehnSettings");
  const widget = document.getElementById("dehnStreakWidget");
  const toggle = document.getElementById("dehnToggle");
  const modal = document.getElementById("dehnSetupModal");
  const info = document.getElementById("dehnSettingInfo");
  if (!settingsCard || !toggle || !widget || !modal) return;

  settingsCard.style.display = "block";
  let state = null;

  function apply() {
    if (!state) return;
    toggle.checked = !!state.enabled;
    if (state.enabled) {
      if (info) info.textContent = `Aktiv · ${state.jokers_per_month} Joker/Monat`;
      widget.style.display = "block";
      renderDehnWidget(state);
    } else {
      if (info) info.textContent = "Deaktiviert.";
      widget.style.display = "none";
    }
  }
  async function refresh() {
    try { state = (await (await api("/api/me/dehn-streak")).json()).streak; } catch { return; }
    apply();
  }

  // Setup modal
  function openSetup() {
    const inp = document.getElementById("dehnJokers");
    if (inp) inp.value = 3;
    modal.style.display = "flex";
  }
  function closeSetup() { modal.style.display = "none"; }
  document.getElementById("dehnSetupCancel")?.addEventListener("click", () => {
    closeSetup();
    if (state) toggle.checked = !!state.enabled; // revert toggle
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) { closeSetup(); if (state) toggle.checked = !!state.enabled; }
  });
  document.getElementById("dehnSetupConfirm")?.addEventListener("click", async () => {
    let jpm = parseInt(document.getElementById("dehnJokers").value, 10);
    if (isNaN(jpm)) jpm = 0;
    jpm = Math.max(0, Math.min(10, jpm));
    const r = await api("/api/me/dehn-streak/enable", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jokers_per_month: jpm })
    });
    closeSetup();
    if (r.ok) await refresh();
    else { alert((await r.json()).error || "Fehler"); if (state) toggle.checked = !!state.enabled; }
  });

  // Toggle on/off
  toggle.addEventListener("change", async () => {
    if (toggle.checked) {
      // Don't activate yet — confirm via setup modal first
      toggle.checked = false;
      openSetup();
    } else {
      if (!confirm("Wenn du den Dehn Streak deaktivierst, wird dein aktueller Streak zurückgesetzt. Fortfahren?")) {
        toggle.checked = true; // revert
        return;
      }
      await api("/api/me/dehn-streak/disable", { method: "POST" });
      await refresh();
    }
  });

  refresh();
}
