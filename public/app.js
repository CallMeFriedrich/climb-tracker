async function api(url, options) {
  const r = await fetch(url, options);
  if (r.status === 401) location.href = "login.html";
  return r;
}

function gradesFor(category, environment) {
  if (category === "lead") {
    return ["4a","4b","4c","5a","5b","5c","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+","7c","7c+","8a","8a+","8b","8b+","8c","8c+","9a"];
  }
  if (category === "boulder" && environment === "outdoor") {
    return ["4a","4b","4c","5a","5b","5c","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+","7c","7c+","8a","8a+","8b","8b+","8c","8c+","9a"];
  }
  return ["1","2","3","4","5","6","7","8","9"];
}

function fillGradeSelect(category, selectedGrade, environment) {
  const sel = document.getElementById("grade");
  if (!sel) return;
  sel.innerHTML = "";
  for (const g of gradesFor(category, environment)) {
    const o = document.createElement("option");
    o.value = g;
    o.textContent = g;
    if (g === selectedGrade) o.selected = true;
    sel.appendChild(o);
  }
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
}

function initQuickLog() {
  const last = getLastChoice();
  let currentCat = last.category;
  const envSelect = document.getElementById("env");

  function currentEnv() {
    return envSelect ? envSelect.value : "indoor";
  }

  // ---- Ascent style / attempts ----
  const LEAD_STYLES = [
    { key: "os",    label: "OS",    desc: "Onsight — erster Versuch, kein Beta, keine Vorinformation." },
    { key: "flash", label: "Flash", desc: "Flash — erster Versuch mit Beta (Zusehen, Tipps, …)." },
    { key: "rp",    label: "RP",    desc: "Rotpunkt — sauberer Durchstieg nach mehreren Versuchen." },
    { key: "pp",    label: "PP",    desc: "Pinkpoint — wie RP, aber Expressschlingen waren vorgehängt." },
  ];
  const BOULDER_ATTEMPTS = [
    { key: "flash", label: "⚡ Flash" },
    { key: "2",  label: "2" }, { key: "3",  label: "3" },
    { key: "4",  label: "4" }, { key: "5",  label: "5" },
    { key: "6",  label: "6" }, { key: "7+", label: "7+" },
  ];

  const styleBtns  = document.getElementById("styleBtns");
  const styleDesc  = document.getElementById("styleDesc");
  const styleInput = document.getElementById("styleInput");
  const attField   = document.getElementById("attemptsField");
  const attValue   = document.getElementById("attValue");
  const attInput   = document.getElementById("attInput");
  const attMinus   = document.getElementById("attMinus");
  const attPlus    = document.getElementById("attPlus");

  let currentStyle = "";
  let currentAttempts = 2;

  function setAttempts(n) {
    currentAttempts = Math.max(2, n);
    if (attValue) attValue.textContent = currentAttempts;
    if (attInput) attInput.value = currentAttempts;
  }

  if (attMinus) attMinus.addEventListener("click", () => setAttempts(currentAttempts - 1));
  if (attPlus)  attPlus.addEventListener("click",  () => setAttempts(currentAttempts + 1));

  function renderStyleBtns() {
    if (!styleBtns) return;
    const isLead = currentCat === "lead";
    const items = isLead ? LEAD_STYLES : BOULDER_ATTEMPTS;
    // Default selection
    if (!currentStyle || !items.find(i => i.key === currentStyle)) {
      currentStyle = items[0].key;
    }
    styleBtns.innerHTML = items.map(item => `
      <button type="button" class="style-btn${currentStyle === item.key ? ' active' : ''}"
              data-style="${item.key}">${item.label}</button>
    `).join("");
    if (styleInput) styleInput.value = isLead ? currentStyle : (currentStyle === "flash" ? "flash" : "");
    // Attempts counter: only for lead RP/PP
    const needsAttempts = isLead && (currentStyle === "rp" || currentStyle === "pp");
    if (attField) attField.style.display = needsAttempts ? "" : "none";
    // Description
    if (styleDesc && isLead) {
      const found = LEAD_STYLES.find(s => s.key === currentStyle);
      styleDesc.textContent = found ? found.desc : "";
      styleDesc.style.display = found ? "" : "none";
    } else if (styleDesc) {
      styleDesc.style.display = "none";
    }
    // Wire up buttons
    styleBtns.querySelectorAll(".style-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        currentStyle = btn.dataset.style;
        renderStyleBtns();
        updateSubmitLabel();
      });
    });
  }

  renderStyleBtns();

  // ---- Category toggle ----
  const toggleBtns = document.querySelectorAll(".toggle-btn[data-cat]");
  toggleBtns.forEach(btn => {
    if (btn.dataset.cat === currentCat) btn.classList.add("active");
    btn.addEventListener("click", () => {
      toggleBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentCat = btn.dataset.cat;
      currentStyle = ""; // reset
      fillGradeSelect(currentCat, "", currentEnv());
      renderStyleBtns();
      updateSubmitLabel();
    });
  });

  // Update grades when environment changes
  if (envSelect) {
    envSelect.addEventListener("change", () => {
      fillGradeSelect(currentCat, "", currentEnv());
      updateSubmitLabel();
    });
  }

  fillGradeSelect(currentCat, last.grade, currentEnv());

  // Hidden category input
  const catInput = document.getElementById("catValue");
  if (catInput) catInput.value = currentCat;
  toggleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (catInput) catInput.value = btn.dataset.cat;
    });
  });

  // Mehr Optionen toggle
  const expandLink = document.getElementById("expandExtras");
  const extraFields = document.getElementById("extraFields");
  if (expandLink && extraFields) {
    expandLink.addEventListener("click", () => {
      extraFields.classList.toggle("visible");
      expandLink.textContent = extraFields.classList.contains("visible") ? "Weniger Optionen" : "Mehr Optionen";
    });
  }

  // Dynamic submit label
  const gradeSelect = document.getElementById("grade");
  const submitBtn = document.getElementById("submitLog");
  function updateSubmitLabel() {
    if (!submitBtn) return;
    const cat = currentCat === "lead" ? "Lead" : "Boulder";
    const grade = gradeSelect ? gradeSelect.value : "";
    const stylePart = currentStyle && currentStyle !== "" ? ` · ${currentStyle.toUpperCase()}` : "";
    submitBtn.textContent = grade ? `${cat} ${grade}${stylePart} speichern` : `${cat} speichern`;
  }
  if (gradeSelect) gradeSelect.addEventListener("change", updateSubmitLabel);
  updateSubmitLabel();

  // Form submit
  const logForm = document.getElementById("logForm");
  if (logForm) {
    logForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      fd.set("category", currentCat);
      const grade = fd.get("grade");

      // Set ascent_style and attempts based on category
      if (currentCat === "boulder") {
        if (currentStyle === "flash") {
          fd.set("ascent_style", "flash");
          fd.set("attempts", "1");
        } else if (currentStyle && currentStyle !== "") {
          fd.set("ascent_style", "");
          fd.set("attempts", currentStyle === "7+" ? "7" : currentStyle);
        }
      } else {
        // lead
        fd.set("ascent_style", currentStyle || "");
        if (currentStyle === "rp" || currentStyle === "pp") {
          fd.set("attempts", String(currentAttempts));
        } else if (currentStyle === "os" || currentStyle === "flash") {
          fd.set("attempts", "1");
        }
      }
      const r = await api("/api/log/me", { method: "POST", body: new URLSearchParams(fd) });
      if (!r.ok) {
        alert((await r.json()).error || "Fehler");
        return;
      }
      saveLastChoice(currentCat, grade);
      // Reload all dashboard data
      const [progressR, leaderboardR, goalsR, logR] = await Promise.all([
        api("/api/progress/me"),
        api("/api/leaderboard/weekly"),
        api("/api/goals/me"),
        api("/api/log/me")
      ]);
      const meR = await api("/api/me");
      const me = (await meR.json()).me;
      renderStatusCard(me, await leaderboardR.json(), await progressR.json());
      renderProgress(await (await api("/api/progress/me")).json());
      initInlineGoals(await goalsR.json(), await (await api("/api/progress/me")).json());
      renderLogbook(await logR.json());
    });
  }
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
        <div class="muted">${achieved} von ${total} Zielen erreicht</div>
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
  // Returns a short badge label for the ascent style/attempts
  if (!e.ascent_style && !e.attempts) return "";
  const STYLE_LABELS = { os: "OS", flash: "⚡ Flash", rp: "RP", pp: "PP" };
  if (e.category === "boulder") {
    if (e.ascent_style === "flash") return "⚡ Flash";
    if (e.attempts && Number(e.attempts) > 1) return `${e.attempts} Versuche`;
    return "";
  }
  // lead
  const label = STYLE_LABELS[e.ascent_style] || "";
  if ((e.ascent_style === "rp" || e.ascent_style === "pp") && e.attempts > 1) {
    return `${label} / ${e.attempts}V`;
  }
  return label;
}

function logCardHtml(e, isSelf) {
  const isOutdoor = e.environment === "outdoor";
  const ascentLabel = fmtAscent(e);
  return `
    <div class="log-card" data-entry-id="${e.id}">
      <div class="log-main">
        <div class="log-grade">
          ${e.category === "lead" ? "Lead" : "Boulder"} ${e.grade}
          <span class="log-env-badge ${isOutdoor ? 'outdoor' : ''}">${isOutdoor ? 'Outdoor' : 'Indoor'}</span>
          ${ascentLabel ? `<span class="log-ascent-badge">${ascentLabel}</span>` : ""}
        </div>
        <div class="log-detail">${fmtDate(e.created_at)}${e.notes ? " · " + escapeHtml(e.notes) : ""}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
        <div class="log-count">×${e.count}</div>
        ${isSelf ? `<button class="btn-delete-entry" data-id="${e.id}" title="Eintrag löschen">✕</button>` : ""}
      </div>
    </div>
  `;
}

function renderLogbook(logData) {
  const el = document.getElementById("log");
  if (!el) return;

  const entries = logData.entries || [];
  if (!entries.length) {
    el.innerHTML = `<div class="empty">Noch keine Logbuch-Einträge.</div>`;
    return;
  }

  el.innerHTML = `
    <div class="log-cards">
      ${entries.map(e => logCardHtml(e)).join("")}
    </div>
  `;
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
  renderUserLog(log, isSelf);

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

function renderUserLog(entries, isSelf) {
  const el = document.getElementById("log");
  if (!el) return;

  if (!entries || !entries.length) {
    el.innerHTML = `<div class="empty">Keine Logbuch-Einträge.</div>`;
    return;
  }

  el.innerHTML = `<div class="log-cards">${entries.map(e => logCardHtml(e, isSelf)).join("")}</div>`;

  if (isSelf) {
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
          if (card) card.remove();
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
}
