async function api(url, options) {
  const r = await fetch(url, options);
  if (r.status === 401) location.href = "login.html";
  return r;
}

function gradesFor(category) {
  if (category === "lead") {
    return ["4a","4b","4c","5a","5b","5c","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+","7c","7c+","8a","8a+","8b","8b+","8c","8c+","9a"];
  }
  return ["1","2","3","4","5","6","7","8","9"];
}

function fillGradeSelect(category) {
  const sel = document.getElementById("grade");
  if (!sel) return;
  sel.innerHTML = "";
  for (const g of gradesFor(category)) {
    const o = document.createElement("option");
    o.value = g;
    o.textContent = g;
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

// ---------- Dashboard ----------
async function initDashboard() {
  const meR = await api("/api/me");
  const me = (await meR.json()).me;

  const myProfileBtn = document.getElementById("myProfileBtn");
  if (myProfileBtn && me) {
    myProfileBtn.href = `profile.html?id=${me.id}`;
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await fetch("/api/logout", { method: "POST" });
      location.href = "login.html";
    };
  }

  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn && me && me.is_admin === 1) {
    resetBtn.style.display = "inline-flex";
    resetBtn.onclick = async () => {
      const ok = confirm("Wirklich ALLE Ziele und ALLE Logbücher von ALLEN Nutzern löschen?");
      if (!ok) return;
      const r = await api("/api/admin/reset", { method: "POST" });
      if (r.ok) {
        await loadLog();
        await loadProgress();
        alert("Reset durchgeführt.");
      } else {
        alert((await r.json()).error || "Reset fehlgeschlagen");
      }
    };
  }

  fillGradeSelect("lead");
  const cat = document.getElementById("cat");
  if (cat) {
    cat.addEventListener("change", (e) => fillGradeSelect(e.target.value));
  }

  const logForm = document.getElementById("logForm");
  if (logForm) {
    logForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const r = await api("/api/log/me", { method: "POST", body: new URLSearchParams(fd) });
      if (!r.ok) {
        alert((await r.json()).error || "Fehler");
        return;
      }
      e.target.reset();
      const countInput = document.querySelector("#logForm input[name=count]");
      if (countInput) countInput.value = 1;

      await loadLog();
      await loadProgress();
    });
  }

  await loadProgress();
  await loadLog();
}

async function loadProgress() {
  const r = await api("/api/progress/me");
  const data = await r.json();
  const el = document.getElementById("progress");
  if (!el) return;

  if (!data.progress || !data.progress.length) {
    el.innerHTML = `<div class="empty">Keine Ziele gesetzt (oder alle Ziele sind 0).</div>`;
    return;
  }

  const orderCategory = (c) => (c === "lead" ? 0 : 1);

  el.innerHTML = data.progress
    .sort((a, b) => {
      const dc = orderCategory(a.category) - orderCategory(b.category);
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

async function loadLog() {
  const r = await api("/api/log/me");
  const data = await r.json();
  const el = document.getElementById("log");
  if (!el) return;

  if (!data.entries || !data.entries.length) {
    el.innerHTML = `<div class="empty">Noch keine Logbuch-Einträge.</div>`;
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
        ${data.entries.map(e => `
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
  `;
}

// ---------- Goals ----------
async function initGoals() {
  const r = await api("/api/goals/me");
  const data = await r.json();

  const current = new Map(data.goals.map(g => [`${g.category}:${g.grade}`, g.target_count]));

  const leadForm = document.getElementById("leadForm");
  if (leadForm) {
    leadForm.innerHTML = data.leadGrades.map(grade => {
      const v = current.get(`lead:${grade}`) ?? 0;
      return `
        <div class="goal-row">
          <div class="glabel">${grade}</div>
          <input type="number" min="0" value="${v}" name="${grade}" inputmode="numeric">
        </div>
      `;
    }).join("");
  }

  const bForm = document.getElementById("boulderForm");
  if (bForm) {
    bForm.innerHTML = data.boulderGrades.map(grade => {
      const v = current.get(`boulder:${grade}`) ?? 0;
      return `
        <div class="goal-row">
          <div class="glabel">${grade}</div>
          <input type="number" min="0" value="${v}" name="${grade}" inputmode="numeric">
        </div>
      `;
    }).join("");
  }

  const saveLeadBtn = document.getElementById("saveLead");
  if (saveLeadBtn) saveLeadBtn.onclick = async () => saveGoals("lead", leadForm);

  const saveBoulderBtn = document.getElementById("saveBoulder");
  if (saveBoulderBtn) saveBoulderBtn.onclick = async () => saveGoals("boulder", bForm);
}

async function saveGoals(category, formEl) {
  const goals = [];
  for (const input of formEl.querySelectorAll("input")) {
    goals.push({ grade: input.name, target_count: Number(input.value) });
  }

  const r = await api("/api/goals/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, goals })
  });

  if (r.ok) alert("Gespeichert.");
  else alert((await r.json()).error || "Fehler beim Speichern");
}

// ---------- Community ----------
async function initCommunity() {
  const r = await api("/api/users");
  const data = await r.json();
  const el = document.getElementById("users");
  if (!el) return;

  el.innerHTML = data.users.map(u => `
    <div class="user-item">
      <div class="meta">
        <div class="name">${escapeHtml(u.username)}</div>
        <div class="sub">ID: ${u.id}</div>
      </div>
      <a class="pill" href="profile.html?id=${u.id}">Ansehen</a>
    </div>
  `).join("");
}

// ---------- Profile ----------
async function initProfile() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id) return;

  // who am I?
  const meR = await api("/api/me");
  const me = (await meR.json()).me;
  const isSelf = me && String(me.id) === String(id);
  const isAdmin = me && me.is_admin === 1;

  // load profile user info (bio etc.)
  const profR = await api(`/api/profile/user/${id}`);
  const profData = await profR.json();
  const profileUser = profData.user;

  // subtitle username
  const subtitle = document.getElementById("subtitle");
  if (subtitle) subtitle.textContent = profileUser ? `Profil: ${profileUser.username}` : `Profil #${id}`;

  // bio view for everyone
  const bioText = document.getElementById("bioText");
  if (bioText) {
    const bio = (profileUser?.bio || "").trim();
    bioText.textContent = bio.length ? bio : "Keine Bio gesetzt.";
  }

  // content (goals/log)
  const goalsR = await api(`/api/goals/user/${id}`);
  const goals = (await goalsR.json()).goals;

  const logR = await api(`/api/log/user/${id}`);
  const log = (await logR.json()).entries;

  renderUserGoals(goals);
  renderUserLog(log);

  // -------- Self actions (only when viewing own profile) --------
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
        if (r.ok) {
          alert("Bio gespeichert.");
          location.reload();
        } else {
          alert((await r.json()).error || "Fehler");
        }
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
        if (r.ok) {
          alert("Username geändert.");
          location.reload();
        } else {
          alert((await r.json()).error || "Fehler");
        }
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
        } else {
          alert((await r.json()).error || "Fehler");
        }
      };
    }

    const deleteMe = document.getElementById("deleteMe");
    if (deleteMe) {
      deleteMe.onclick = async () => {
        const ok = confirm("Wirklich deinen Account löschen? Das kann nicht rückgängig gemacht werden.");
        if (!ok) return;

        const r = await api("/api/me/delete", { method: "POST" });
        if (r.ok) {
          location.href = "register.html";
        } else {
          alert((await r.json()).error || "Fehler");
        }
      };
    }
  }

  // -------- Admin actions (admin can manage other users) --------
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

        if (r.ok) {
          alert("Username geändert.");
          location.reload();
        } else {
          alert((await r.json()).error || "Fehler");
        }
      };
    }

    const adminDeleteBtn = document.getElementById("adminDelete");
    if (adminDeleteBtn) {
      adminDeleteBtn.onclick = async () => {
        const ok = confirm("Wirklich diesen Benutzer löschen? Das kann nicht rückgängig gemacht werden.");
        if (!ok) return;

        const r = await api(`/api/admin/delete-user/${id}`, { method: "POST" });
        if (r.ok) {
          location.href = "community.html";
        } else {
          alert((await r.json()).error || "Fehler");
        }
      };
    }

    const userResetBtn = document.getElementById("userResetBtn");
    if (userResetBtn) {
      userResetBtn.onclick = async () => {
        const ok = confirm("Ziele + Logbuch dieses Benutzers wirklich löschen?");
        if (!ok) return;

        const r = await api(`/api/admin/reset-user/${id}`, { method: "POST" });
        if (r.ok) {
          alert("Benutzer zurückgesetzt.");
          location.reload();
        } else {
          alert((await r.json()).error || "Fehler");
        }
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
        } else {
          alert((await r.json()).error || "Fehler");
        }
      };
    }
  }
}

function renderUserGoals(goals) {
  const el = document.getElementById("goals");
  if (!el) return;

  if (!goals || !goals.length) {
    el.innerHTML = `<div class="empty">Keine Ziele.</div>`;
    return;
  }

  const lead = goals
    .filter(g => g.category === "lead")
    .sort((a, b) => String(a.grade).localeCompare(String(b.grade), "de"));

  const boulder = goals
    .filter(g => g.category === "boulder")
    .sort((a, b) => Number(a.grade) - Number(b.grade));

  el.innerHTML = `
    <div class="list">
      <div class="badge">Lead</div>
      ${lead.length ? lead.map(g => `
        <div class="kpi">
          <div><strong>${g.grade}</strong><div class="muted">Ziel</div></div>
          <div class="badge">${g.target_count}</div>
        </div>
      `).join("") : `<div class="empty">Keine Lead Ziele.</div>`}
      <div class="divider"></div>
      <div class="badge">Boulder</div>
      ${boulder.length ? boulder.map(g => `
        <div class="kpi">
          <div><strong>${g.grade}</strong><div class="muted">Ziel</div></div>
          <div class="badge">${g.target_count}</div>
        </div>
      `).join("") : `<div class="empty">Keine Boulder Ziele.</div>`}
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

  // FIX: Umgebung auch im Profil anzeigen
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

// ---------- Leaderboard ----------
async function initWeeklyLeaderboard() {
  const r = await api("/api/leaderboard/weekly");
  const data = await r.json();

  const startEl = document.getElementById("start");
  if (startEl) startEl.textContent = data.startOfWeek;

  const el = document.getElementById("board");
  if (!el) return;

  const rows = data.rows || [];
  if (!rows.length) {
    el.innerHTML = `<div class="empty">Keine Daten.</div>`;
    return;
  }

  el.innerHTML = `
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
          <tr>
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