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

  // Toggle buttons
  const toggleBtns = document.querySelectorAll(".toggle-btn[data-cat]");
  toggleBtns.forEach(btn => {
    if (btn.dataset.cat === currentCat) btn.classList.add("active");
    btn.addEventListener("click", () => {
      toggleBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentCat = btn.dataset.cat;
      fillGradeSelect(currentCat, "", currentEnv());
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

  // Update hidden input on toggle
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
    submitBtn.textContent = grade ? `${cat} ${grade} speichern` : `${cat} speichern`;
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

function renderLogbook(logData) {
  const el = document.getElementById("log");
  if (!el) return;

  const entries = logData.entries || [];
  if (!entries.length) {
    el.innerHTML = `<div class="empty">Noch keine Logbuch-Einträge.</div>`;
    return;
  }

  el.innerHTML = `
    <div class="log-table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Kategorie</th>
            <th>Grad</th>
            <th>Umgebung</th>
            <th>Anzahl</th>
            <th>Notiz</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(e => `
            <tr>
              <td>${e.created_at}</td>
              <td>${e.category}</td>
              <td>${e.grade}</td>
              <td>${escapeHtml(e.environment || "indoor")}</td>
              <td>x${e.count}</td>
              <td>${escapeHtml(e.notes || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <div class="log-cards">
      ${entries.map(e => `
        <div class="log-card">
          <div class="log-main">
            <div class="log-grade">${e.category === "lead" ? "Lead" : "Boulder"} ${e.grade}</div>
            <div class="log-detail">${e.created_at} · ${escapeHtml(e.environment || "indoor")}${e.notes ? " · " + escapeHtml(e.notes) : ""}</div>
          </div>
          <div class="log-count">x${e.count}</div>
        </div>
      `).join("")}
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

  if (boardEl) {
    if (!rows.length) {
      boardEl.innerHTML = `<div class="empty">Keine Daten diese Woche.</div>`;
    } else {
      boardEl.innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>User</th>
              <th>Score</th>
              <th>Lead</th>
              <th>Boulder</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((u, i) => `
              <tr class="${me && String(u.user_id) === String(me.id) ? 'highlight' : ''}">
                <td>${i + 1}</td>
                <td><a href="profile.html?id=${u.user_id}">${escapeHtml(u.username)}</a></td>
                <td><strong>${u.score ?? 0}</strong></td>
                <td>${u.lead_count ?? 0}</td>
                <td>${u.boulder_count ?? 0}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }
  }

  // Render users
  const usersEl = document.getElementById("users");
  if (usersEl) {
    usersEl.innerHTML = usersData.users.map(u => `
      <div class="user-item">
        <div class="meta">
          <div class="name">${escapeHtml(u.username)}</div>
          <div class="sub">ID: ${u.id}</div>
        </div>
        <a class="pill" href="profile.html?id=${u.id}">Ansehen</a>
      </div>
    `).join("");
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
  renderUserLog(log);

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

  // Build lookup: "YYYY-MM-DD" -> total count
  const map = {};
  for (const r of activity) map[r.day] = Number(r.total);

  // Determine max for scaling
  const max = Math.max(1, ...Object.values(map));

  // Build 365-day grid starting from today going back
  // Align to start of the week (Monday) so columns line up cleanly
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the Monday 52 full weeks ago
  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() - 364);
  // Rewind to Monday
  const dow = (startDay.getDay() + 6) % 7; // 0=Mon
  startDay.setDate(startDay.getDate() - dow);

  const DAY_NAMES = ["Mo", "", "Mi", "", "Fr", "", "So"];
  const MONTH_NAMES = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

  // Build columns (each column = one week, 7 days)
  const columns = [];
  let cur = new Date(startDay);
  while (cur <= today) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const iso = cur.toISOString().slice(0, 10);
      week.push({ iso, count: map[iso] || 0, future: cur > today });
      cur.setDate(cur.getDate() + 1);
    }
    columns.push(week);
  }

  // Month labels: detect when month changes between columns
  const monthLabels = columns.map((week, i) => {
    const firstDay = new Date(week[0].iso);
    if (i === 0 || new Date(columns[i-1][0].iso).getMonth() !== firstDay.getMonth()) {
      return MONTH_NAMES[firstDay.getMonth()];
    }
    return "";
  });

  function levelFor(count) {
    if (count === 0) return 0;
    if (count <= Math.ceil(max * 0.25)) return 1;
    if (count <= Math.ceil(max * 0.5))  return 2;
    if (count <= Math.ceil(max * 0.75)) return 3;
    return 4;
  }

  // Total climbs this year
  const totalClimbs = Object.values(map).reduce((a, b) => a + b, 0);
  const activeDays = Object.values(map).filter(v => v > 0).length;

  el.innerHTML = `
    <div class="activity-header">
      <span>${totalClimbs} Routen an ${activeDays} Tagen in den letzten 365 Tagen</span>
    </div>
    <div class="activity-wrap">
      <div class="activity-day-labels">
        ${DAY_NAMES.map(n => `<div class="activity-day-label">${n}</div>`).join("")}
      </div>
      <div class="activity-grid-wrap">
        <div class="activity-month-row">
          ${monthLabels.map(m => `<div class="activity-month-label">${m}</div>`).join("")}
        </div>
        <div class="activity-grid">
          ${columns.map(week => `
            <div class="activity-col">
              ${week.map(day => `
                <div
                  class="activity-cell level-${day.future ? 0 : levelFor(day.count)}"
                  title="${day.iso}${day.count ? ': ' + day.count + ' Routen' : ''}"
                ></div>
              `).join("")}
            </div>
          `).join("")}
        </div>
      </div>
    </div>
    <div class="activity-legend">
      <span class="muted">Weniger</span>
      ${[0,1,2,3,4].map(l => `<div class="activity-cell level-${l}"></div>`).join("")}
      <span class="muted">Mehr</span>
    </div>
  `;
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

function renderUserLog(entries) {
  const el = document.getElementById("log");
  if (!el) return;

  if (!entries || !entries.length) {
    el.innerHTML = `<div class="empty">Keine Logbuch-Einträge.</div>`;
    return;
  }

  el.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Datum</th>
          <th>Kategorie</th>
          <th>Grad</th>
          <th>Umgebung</th>
          <th>Anzahl</th>
          <th>Notiz</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(e => `
          <tr>
            <td>${e.created_at}</td>
            <td>${e.category}</td>
            <td>${e.grade}</td>
            <td>${escapeHtml(e.environment || "Indoor")}</td>
            <td>x${e.count}</td>
            <td>${escapeHtml(e.notes || "")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}
