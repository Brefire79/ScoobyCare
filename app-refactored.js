// ScoobyCare — app-refactored.js (Versão Simplificada)
// - Sem duplicidades
// - Código organizado por responsabilidade
// - Funcionalidade de áudio unificada
// - Settings consolidados

const STORAGE_KEY = "scoobycare_state_v1";
const ALERT_SOON_DAYS = 7;
const PUSH_SERVER_DEFAULT_PROD_URL = "https://SEU_BACKEND_AQUI";
const PUSH_SERVER_URL_STORAGE_KEY = "scoobycare_push_server_url_v1";

let AppState = null;

/* ===============================
   UTILIDADES DE DATA (SIMPLIFICADO)
================================ */
const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const asLocalDate = (iso) => (iso ? new Date(`${iso}T00:00:00`) : null);

const isoFromLocalDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const daysBetween = (fromISO, toISO) => {
  const a = asLocalDate(fromISO);
  const b = asLocalDate(toISO);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000);
};

const nextDateFrom = (dateISO, intervalDays) => {
  if (!dateISO || !intervalDays) return null;
  const d = asLocalDate(dateISO);
  d.setDate(d.getDate() + Number(intervalDays));
  return isoFromLocalDate(d);
};

const nextDateMonthsFrom = (dateISO, everyMonths) => {
  if (!dateISO || !everyMonths) return null;
  const d = asLocalDate(dateISO);
  d.setMonth(d.getMonth() + Number(everyMonths));
  return isoFromLocalDate(d);
};

const formatDate = (iso) => {
  if (!iso) return "—";
  const d = asLocalDate(iso);
  return d.toLocaleDateString("pt-BR");
};

const generateId = (prefix) => `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;

const escapeHTML = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ===============================
   UTILITÁRIOS DE UI (SIMPLIFICADO)
================================ */
const showToast = (msg) => {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => el.classList.add("hidden"), 2400);
};

const notify = async (msg) => {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission === "granted") new Notification("ScoobyCare", { body: msg });
  } catch {}
};

/* ===============================
   ÁUDIO UNIFICADO (SIMPLIFICADO)
================================ */
const Audio = {
  ctx: null,
  enabled: false,
  unlocked: false,

  init() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    this.ctx = new Ctx();
    return true;
  },

  async unlock() {
    if (this.unlocked || !this.ctx) return true;
    try {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      // Silent unlock
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.01);
      this.unlocked = true;
      return true;
    } catch {
      return false;
    }
  },

  async play(freq = 660, ms = 160) {
    if (!this.enabled || !this.unlocked || !this.ctx) return false;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, this.ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + (ms / 1000));
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + (ms / 1000) + 0.02);
      return true;
    } catch {
      return false;
    }
  },

  // Padrão de sons diferentes por tipo
  getPattern(kind) {
    if (kind === "med") return [{ f: 520, d: 220 }, { gap: 90 }, { f: 520, d: 220 }];
    if (kind === "vac") return [{ f: 880, d: 160 }, { gap: 70 }, { f: 1040, d: 160 }];
    if (kind === "routine") return [{ f: 740, d: 120 }, { gap: 70 }, { f: 740, d: 120 }, { gap: 70 }, { f: 740, d: 120 }];
    return [{ f: 660, d: 160 }];
  },

  async playPattern(kind) {
    const seq = this.getPattern(kind);
    let ok = false;
    for (const step of seq) {
      if (step.gap) { await sleep(step.gap); continue; }
      ok = (await this.play(step.f, step.d)) || ok;
      await sleep(40);
    }
    return ok;
  },

  canPlayForItem(itemId) {
    const lastPlayDate = AppState.settings?.lastSoundByItem?.[itemId];
    return lastPlayDate !== todayISO();
  },

  markPlayed(itemId) {
    if (!AppState.settings?.lastSoundByItem) {
      if (!AppState.settings) AppState.settings = {};
      AppState.settings.lastSoundByItem = {};
    }
    AppState.settings.lastSoundByItem[itemId] = todayISO();
    saveState();
  }
};

/* ===============================
   CÁLCULO DE STATUS (UNIFICADO)
================================ */
const computeStatus = (dueDate) => {
  if (!dueDate) return { label: "Sem data", className: "muted", diff: null };
  const diff = daysBetween(todayISO(), dueDate);
  if (diff < 0) return { label: `Vencido há ${Math.abs(diff)}d`, className: "late", diff };
  if (diff === 0) return { label: "Vence hoje", className: "soon", diff };
  if (diff <= ALERT_SOON_DAYS) return { label: `Vence em ${diff}d`, className: "soon", diff };
  return { label: `Falta ${diff}d`, className: "ok", diff };
};

/* ===============================
   COLETA DE EVENTOS (SIMPLIFICADA)
================================ */
const getNextDate = (item) => {
  if (item.kind === "med") {
    const lastApp = item.applications?.length ? item.applications[item.applications.length - 1].date : null;
    return lastApp ? nextDateFrom(lastApp, item.intervalDays) : null;
  }
  if (item.kind === "vac") {
    const lastDose = item.doses?.length ? item.doses[item.doses.length - 1] : null;
    return lastDose ? nextDateFrom(lastDose, item.intervalDays) : null;
  }
  if (item.kind === "routine") {
    const lastLog = item.logs?.length ? item.logs[item.logs.length - 1] : null;
    return lastLog?.date ? nextDateMonthsFrom(lastLog.date, item.everyMonths) : todayISO();
  }
  return null;
};

const collectUpcoming = (pet) => {
  const list = [];

  (pet.medications || []).forEach((m) => {
    const next = getNextDate(m);
    list.push({
      kind: "med",
      id: m.id,
      title: `${m.name}${m.doseLabel ? ` (${m.doseLabel})` : ""}`,
      detail: `Intervalo: ${m.intervalDays} dias`,
      date: next
    });
  });

  (pet.vaccinations || []).forEach((v) => {
    const next = getNextDate(v);
    list.push({
      kind: "vac",
      id: v.id,
      title: `Vacina: ${v.name}`,
      detail: `Reforço: ${v.intervalDays} dias`,
      date: next
    });
  });

  (pet.routines || []).forEach((r) => {
    const next = getNextDate(r);
    list.push({
      kind: "routine",
      id: r.id,
      title: r.name,
      detail: `A cada ${r.everyMonths} mês(es)`,
      date: next
    });
  });

  return list
    .map((e) => ({ ...e, status: computeStatus(e.date) }))
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return asLocalDate(a.date) - asLocalDate(b.date);
    });
};

/* ===============================
   EXPORTAÇÃO .ICS (UNIFICADA)
================================ */
const icsEscape = (s) =>
  String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");

const ymdToICSDate = (iso) => iso ? iso.replaceAll("-", "") : "";

const buildICS = (events, calendarName = "ScoobyCare") => {
  const dtstamp = ymdToICSDate(todayISO()) + "T000000Z";
  const vevents = events
    .filter(e => e.date)
    .map((e) => {
      const uid = `${e.kind || "evt"}-${e.id || "x"}-${ymdToICSDate(e.date)}@scoobycare`;
      const d = ymdToICSDate(e.date);
      const summary = icsEscape(e.title);
      const desc = icsEscape(e.detail || "");
      return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${d}`,
        `SUMMARY:${summary}`,
        desc ? `DESCRIPTION:${desc}` : null,
        "END:VEVENT"
      ].filter(Boolean).join("\r\n");
    })
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ScoobyCare//PT-BR//EN",
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
    vevents,
    "END:VCALENDAR"
  ].filter(Boolean).join("\r\n");
};

const downloadTextFile = (filename, text, mime = "text/plain") => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const exportICSSingle = (kind, id) => {
  const pet = getPet();
  let evt = null;

  if (kind === "med") {
    const m = (pet.medications || []).find(x => x.id === id);
    if (m) {
      const next = getNextDate(m);
      evt = { kind, id, title: m.name, detail: `Intervalo: ${m.intervalDays} dias`, date: next };
    }
  } else if (kind === "vac") {
    const v = (pet.vaccinations || []).find(x => x.id === id);
    if (v) {
      const next = getNextDate(v);
      evt = { kind, id, title: `Vacina: ${v.name}`, detail: `Reforço: ${v.intervalDays} dias`, date: next };
    }
  } else if (kind === "routine") {
    const r = (pet.routines || []).find(x => x.id === id);
    if (r) {
      const next = getNextDate(r);
      evt = { kind, id, title: r.name, detail: `A cada ${r.everyMonths} mês(es)`, date: next };
    }
  }

  if (!evt || !evt.date) return showToast("Sem próxima data para exportar");
  const ics = buildICS([evt], "ScoobyCare — Evento");
  const safe = (evt.title || "evento").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  downloadTextFile(`scoobycare-${safe}.ics`, ics, "text/calendar");
  showToast(".ics exportado");
};

const exportICSAll = () => {
  const pet = getPet();
  const events = collectUpcoming(pet).filter(e => e.date);
  const limited = events.filter(e => {
    const diff = daysBetween(todayISO(), e.date);
    return diff >= -30 && diff <= 180;
  });
  const ics = buildICS(limited, "ScoobyCare — Alertas");
  downloadTextFile("scoobycare-alertas.ics", ics, "text/calendar");
  showToast("Calendário .ics exportado");
};

/* ===============================
   RENDERING GENÉRICA (SIMPLIFICADA)
================================ */
const renderItemCard = (item) => {
  const next = getNextDate(item);
  const status = computeStatus(next);
  const badge = `<span class="badge ${status.className}">${status.label}</span>`;

  let lastDate = "—";
  if (item.kind === "med") {
    lastDate = item.applications?.length ? formatDate(item.applications[item.applications.length - 1].date) : "—";
  } else if (item.kind === "vac") {
    lastDate = item.doses?.length ? formatDate(item.doses[item.doses.length - 1]) : "—";
  } else if (item.kind === "routine") {
    lastDate = item.logs?.length ? formatDate(item.logs[item.logs.length - 1].date) : "—";
  }

  const title = item.kind === "vac" ? item.title : item.name || item.title;
  const label = item.kind === "routine" ? "Marcar feito" : "Registrar dose";

  return `
    <div class="card">
      <h2>${title}</h2>
      <p class="small-text">${item.detail || item.doseLabel || ""}</p>
      <div class="actions-row" style="justify-content:space-between; margin-top:10px">
        ${badge}
        <div class="actions-row">
          <button class="btn primary" data-do-action="${item.kind}:${item.id}">${label}</button>
          <button class="btn secondary" data-ics-kind="${item.kind}" data-ics-id="${item.id}">📅</button>
          <button class="btn" data-del-item="${item.kind}:${item.id}">Excluir</button>
        </div>
      </div>
      <p class="small-text" style="margin-top:10px">Última: ${lastDate} • Próxima: ${formatDate(next)}</p>
    </div>
  `;
};

const renderMeds = () => {
  const pet = getPet();
  const container = document.getElementById("med-list");
  if (!container) return;
  const meds = pet.medications || [];
  container.innerHTML = meds.length ? meds.map(renderItemCard).join("") : `<div class="small-text">Nenhum medicamento cadastrado.</div>`;
};

const renderVaccines = () => {
  const pet = getPet();
  const container = document.getElementById("vaccines-list");
  if (!container) return;
  const vacs = pet.vaccinations || [];
  container.innerHTML = vacs.length ? vacs.map(renderItemCard).join("") : `<div class="small-text">Nenhuma vacina cadastrada.</div>`;
};

const renderRoutines = () => {
  const pet = getPet();
  const container = document.getElementById("routine-list");
  if (!container) return;
  const routines = pet.routines || [];
  container.innerHTML = routines.length ? routines.map(renderItemCard).join("") : `<div class="small-text">Nenhuma rotina cadastrada.</div>`;
};

const renderWeights = () => {
  const pet = getPet();
  const listEl = document.getElementById("weight-list");
  if (!listEl) return;
  const items = [...(pet.weightRecords || [])].sort((a, b) => asLocalDate(b.date) - asLocalDate(a.date));
  listEl.innerHTML = items.length ? items.map(w => `
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${w.kg.toFixed(2)} kg</div>
        <div class="list-sub">${formatDate(w.date)}${w.note ? ` • ${w.note}` : ""}</div>
      </div>
      <div class="list-right">
        <button class="btn secondary" data-edit-weight="${w.id}">Editar</button>
        <button class="btn" data-del-weight="${w.id}">Excluir</button>
      </div>
    </div>
  `).join("") : `<div class="small-text">Sem registros ainda.</div>`;
};

const renderHome = () => {
  const pet = getPet();
  const events = collectUpcoming(pet);

  const lastW = pet.weightRecords?.length ? pet.weightRecords[pet.weightRecords.length - 1] : null;
  const heroWeight = document.getElementById("hero-weight");
  if (heroWeight) {
    heroWeight.textContent = lastW
      ? `Último peso: ${lastW.kg.toFixed(2)} kg (${formatDate(lastW.date)})`
      : "Último peso: —";
  }

  const nextEvt = events.find((e) => e.date) || null;
  const heroNext = document.getElementById("hero-next");
  if (heroNext) {
    heroNext.textContent = `Próximo: ${nextEvt ? `${nextEvt.title} (${formatDate(nextEvt.date)})` : "—"}`;
  }

  const profile = document.getElementById("home-profile");
  if (profile) {
    const p = pet.profile;
    profile.innerHTML = `
      <div><strong>${p.name}</strong></div>
      <div>${p.breed} • Nasc: ${formatDate(p.birthDate)}</div>
    `;
  }

  const late = events.filter((e) => e.status.className === "late");
  const soon = events.filter((e) => e.status.className === "soon");
  const alertEl = document.getElementById("home-alerts");
  if (alertEl) {
    const title = late.length
      ? `🚨 ${late.length} pendência(s) vencida(s)`
      : soon.length ? `⏰ ${soon.length} coisa(s) vencendo` : `✅ Tudo em dia`;
    alertEl.innerHTML = `<h2>Alertas</h2><p><strong>${title}</strong></p>`;
  }

  const upcomingEl = document.getElementById("home-upcoming");
  if (upcomingEl) {
    upcomingEl.innerHTML = events.slice(0, 10).map((e) => `
      <div class="list-item">
        <div><strong>${e.title}</strong> • <span class="badge ${e.status.className}">${e.status.label}</span></div>
        <div class="small-text">${formatDate(e.date)}</div>
      </div>
    `).join("") || `<div class="small-text">Nenhum evento.</div>`;
  }

  // Tocar som de alerta se necessário
  if (AppState.settings?.soundEnabled && Audio.enabled && Audio.unlocked) {
    const urgent = events.filter(e => e.status.className === "late" || e.status.className === "soon").slice(0, 3);
    for (const evt of urgent) {
      if (Audio.canPlayForItem(evt.id)) {
        Audio.playPattern(evt.kind).then(() => Audio.markPlayed(evt.id));
      }
    }
  }
};

const renderFood = () => {
  const pet = getPet();
  const current = document.getElementById("food-current");
  const history = document.getElementById("food-history");
  if (current) {
    const c = pet.food?.current;
    current.innerHTML = c ? `
      <div><strong>Desde:</strong> ${formatDate(c.since)}</div>
      <div style="margin-top:8px">${c.text}</div>
    ` : `<div class="small-text">Sem alimentação.</div>`;
  }
  if (history) {
    const h = [...(pet.food?.history || [])].sort((a, b) => asLocalDate(b.date) - asLocalDate(a.date));
    history.innerHTML = h.length ? h.map(x => `
      <div class="list-item">
        <div class="list-title">${formatDate(x.date)}</div>
        <div class="list-sub">${x.text}</div>
      </div>
    `).join("") : `<div class="small-text">Sem histórico.</div>`;
  }
};

const renderTimeline = () => {
  const pet = getPet();
  const el = document.getElementById("timeline");
  if (!el) return;
  const items = [...(pet.timeline || [])].sort((a, b) => asLocalDate(b.date) - asLocalDate(a.date));
  el.innerHTML = items.length ? items.map(t => `
    <div class="list-item">
      <div><strong>${t.title}</strong> • ${formatDate(t.date)}</div>
      <div class="small-text">${t.detail || ""}</div>
    </div>
  `).join("") : `<div class="small-text">Sem eventos.</div>`;
};

const renderAll = () => {
  renderHome();
  renderWeights();
  renderMeds();
  renderVaccines();
  renderRoutines();
  renderFood();
  renderTimeline();
};

/* ===============================
   STORAGE / STATE (SIMPLIFICADO)
================================ */
const loadState = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedState();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.pets?.length) return seedState();
    return parsed;
  } catch {
    return seedState();
  }
};

const saveState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState));
  const sync = document.getElementById("sync-status");
  if (sync) sync.textContent = "Salvo";
};

const getPet = () => AppState.pets[0];

const pushTimeline = ({ date, type, title, detail }) => {
  const pet = getPet();
  pet.timeline = pet.timeline || [];
  pet.timeline.push({ id: generateId("t"), date, type, title, detail });
};

const seedState = () => ({
  schemaVersion: 1,
  pets: [
    {
      id: "pet_scooby",
      profile: {
        name: "Scooby The Rappy",
        species: "Cachorro",
        breed: "Beagle",
        birthDate: "2022-03-17",
        neuteredDate: "2023-08-24",
        notes: "Saúde geral boa"
      },
      weightRecords: [
        { id: "w_2025-09-19", date: "2025-09-19", kg: 13.65, note: "" }
      ],
      medications: [
        {
          id: "med_bravecto",
          name: "Bravecto",
          doseLabel: "10–20 kg",
          intervalDays: 90,
          applications: [
            { id: "a_2025-09-18", date: "2025-09-18", note: "" }
          ]
        }
      ],
      vaccinations: [
        { id: "vac_rabies", name: "Antirrábica", intervalDays: 365, doses: [] },
        { id: "vac_v8", name: "V8/V10", intervalDays: 365, doses: [] }
      ],
      routines: [
        { id: "rt_feces_exam", name: "Exame de fezes", everyMonths: 1, logs: [] },
        { id: "rt_dewormer", name: "Vermífugo", everyMonths: 6, logs: [] }
      ],
      food: {
        current: {
          since: "2025-09-19",
          text: "150 g Biofresh + legumes à noite"
        },
        history: []
      },
      timeline: [
        { id: "t_initial", date: "2025-09-19", type: "saúde", title: "Perfil criado", detail: "" }
      ]
    }
  ],
  settings: {
    soundEnabled: false,
    lastSoundByItem: {},
    alertDaysAhead: 7
  }
});

/* ===============================
   ROTAS
================================ */
const setActiveRoute = (route) => {
  document.querySelectorAll(".view").forEach((v) => {
    const name = v.getAttribute("data-view");
    v.classList.toggle("hidden", name !== route);
  });
  setActiveLinkByRoute(route);
};

const getRouteFromHash = () => {
  const h = (location.hash || "#home").replace("#", "");
  const allowed = ["home", "peso", "meds", "vaccines", "routines", "food", "history", "settings"];
  return allowed.includes(h) ? h : "home";
};

const setActiveLinkByRoute = (route) => {
  document.querySelectorAll(".sidebar-link").forEach((link) => {
    const linkRoute = link.getAttribute("data-route");
    link.classList.toggle("active", linkRoute === route);
  });
};

/* ===============================
   EVENTOS (SIMPLIFICADO)
================================ */
const attachEvents = () => {
  // Peso
  document.getElementById("weight-date").value = todayISO();
  document.getElementById("weight-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = document.getElementById("weight-date").value;
    const kg = Number(document.getElementById("weight-kg").value);
    const note = document.getElementById("weight-note").value.trim();
    if (!date || kg <= 0) return;

    const pet = getPet();
    pet.weightRecords = pet.weightRecords || [];
    pet.weightRecords.push({ id: generateId("w"), date, kg, note });
    pushTimeline({ date, type: "peso", title: "Peso registrado", detail: `${kg.toFixed(2)} kg` });
    saveState();
    renderAll();
    showToast("Peso salvo");
    e.target.reset();
    document.getElementById("weight-date").value = todayISO();
  });

  // Deletar peso
  document.getElementById("weight-list")?.addEventListener("click", (e) => {
    const del = e.target.closest("button[data-del-weight]");
    if (del) {
      getPet().weightRecords = (getPet().weightRecords || []).filter(w => w.id !== del.dataset.delWeight);
      saveState();
      renderAll();
      showToast("Removido");
    }
  });

  // Adicionar medicamento
  document.getElementById("med-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("med-name").value.trim();
    const doseLabel = document.getElementById("med-dose").value.trim();
    const intervalDays = Number(document.getElementById("med-interval").value);
    if (!name || intervalDays <= 0) return;

    getPet().medications = getPet().medications || [];
    getPet().medications.push({ id: generateId("med"), name, doseLabel, intervalDays, applications: [] });
    saveState();
    renderMeds();
    showToast("Medicamento adicionado");
    e.target.reset();
  });

  // Ações em medicamentos, vacinas e rotinas
  const handleItemAction = async (e, containerType) => {
    const del = e.target.closest("[data-del-item]");
    if (del) {
      const [kind, id] = del.dataset.delItem.split(":");
      const pet = getPet();
      if (kind === "med") pet.medications = (pet.medications || []).filter(x => x.id !== id);
      else if (kind === "vac") pet.vaccinations = (pet.vaccinations || []).filter(x => x.id !== id);
      else if (kind === "routine") pet.routines = (pet.routines || []).filter(x => x.id !== id);
      saveState();
      renderAll();
      showToast("Removido");
      return;
    }

    const ics = e.target.closest("[data-ics-kind]");
    if (ics) {
      exportICSSingle(ics.dataset.icsKind, ics.dataset.icsId);
      return;
    }

    const action = e.target.closest("[data-do-action]");
    if (action) {
      const [kind, id] = action.dataset.doAction.split(":");
      const date = await openDateDialog({ title: "Registrar", sub: "Data do registro:", defaultISO: todayISO() });
      if (!date) return;

      const pet = getPet();
      if (kind === "med") {
        const m = (pet.medications || []).find(x => x.id === id);
        if (m) {
          m.applications = m.applications || [];
          m.applications.push({ id: generateId("a"), date, note: "" });
          pushTimeline({ date, type: "med", title: `${m.name} aplicado`, detail: "" });
        }
      } else if (kind === "vac") {
        const v = (pet.vaccinations || []).find(x => x.id === id);
        if (v) {
          v.doses = v.doses || [];
          v.doses.push(date);
          pushTimeline({ date, type: "vacina", title: `${v.name} aplicada`, detail: "" });
        }
      } else if (kind === "routine") {
        const r = (pet.routines || []).find(x => x.id === id);
        if (r) {
          r.logs = r.logs || [];
          r.logs.push({ id: generateId("log"), date, note: "" });
          pushTimeline({ date, type: "rotina", title: `${r.name} feito`, detail: "" });
        }
      }
      saveState();
      renderAll();
      showToast("Registrado");
    }
  };

  document.getElementById("med-list")?.addEventListener("click", (e) => handleItemAction(e, "med"));
  document.getElementById("vaccines-list")?.addEventListener("click", (e) => handleItemAction(e, "vac"));
  document.getElementById("routine-list")?.addEventListener("click", (e) => handleItemAction(e, "routine"));

  // Adicionar vacina
  document.getElementById("vaccine-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("vaccine-name").value.trim();
    const intervalDays = Number(document.getElementById("vaccine-interval").value);
    if (!name || intervalDays <= 0) return;

    getPet().vaccinations = getPet().vaccinations || [];
    getPet().vaccinations.push({ id: generateId("vac"), name, intervalDays, doses: [] });
    saveState();
    renderVaccines();
    showToast("Vacina adicionada");
    e.target.reset();
  });

  // Adicionar rotina
  document.getElementById("routine-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("routine-name").value.trim();
    const everyMonths = Number(document.getElementById("routine-every").value);
    if (!name || everyMonths <= 0) return;

    getPet().routines = getPet().routines || [];
    getPet().routines.push({ id: generateId("rt"), name, everyMonths, logs: [] });
    saveState();
    renderRoutines();
    showToast("Rotina adicionada");
    e.target.reset();
  });

  // Alimentação
  document.getElementById("food-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = document.getElementById("food-text").value.trim();
    if (!text) return;

    const pet = getPet();
    pet.food = pet.food || { current: null, history: [] };
    const date = await openDateDialog({ title: "Alimentação", sub: "Data:", defaultISO: todayISO() });
    if (!date) return;

    pet.food.current = { since: date, text };
    pet.food.history = pet.food.history || [];
    pet.food.history.push({ id: generateId("food"), date, text });
    pushTimeline({ date, type: "alimentação", title: "Alimentação atualizada", detail: text });
    saveState();
    renderAll();
    showToast("Salvo");
  });

  // Audio toggle
  const toggleSound = document.getElementById("toggle-sound");
  if (toggleSound) {
    toggleSound.checked = !!AppState.settings?.soundEnabled;
    toggleSound.addEventListener("change", async () => {
      AppState.settings.soundEnabled = toggleSound.checked;
      if (toggleSound.checked) {
        const ok = await Audio.unlock();
        if (!ok) {
          toggleSound.checked = false;
          AppState.settings.soundEnabled = false;
          showToast("⚠️ Áudio não disponível");
        }
      }
      saveState();
    });
  }

  // Exportar/Importar
  document.getElementById("btn-ics-all")?.addEventListener("click", exportICSAll);
  document.getElementById("btn-export")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(AppState, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scoobycare-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup exportado");
  });

  document.getElementById("import-file")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed?.pets?.length) throw new Error("Inválido");
      AppState = parsed;
      saveState();
      renderAll();
      showToast("Importado");
    } catch {
      showToast("Erro na importação");
    }
    e.target.value = "";
  });

  // Rotas
  window.addEventListener("hashchange", () => setActiveRoute(getRouteFromHash()));

  // Status online/offline
  const updateOnline = () => {
    const el = document.getElementById("online-status");
    if (el) {
      el.textContent = navigator.onLine ? "Online" : "Offline";
      el.classList.toggle("online", navigator.onLine);
    }
  };
  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);
  updateOnline();
};

/* ===============================
   MODAL DE DATA (SIMPLIFICADO)
================================ */
let _dateDialogResolver = null;

const isValidISO = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""));
const clampISO = (iso) => (isValidISO(iso) ? iso : todayISO());

const openDateDialog = ({ title = "Selecionar data", sub = "", defaultISO = todayISO() } = {}) => {
  return new Promise((resolve) => {
    const dlg = document.getElementById("date-dialog");
    const input = document.getElementById("date-dialog-input");
    if (!dlg || !input) {
      resolve(prompt(title, defaultISO) || null);
      return;
    }

    input.value = clampISO(defaultISO);
    dlg.showModal();

    _dateDialogResolver = (result) => {
      const v = (input.value || "").trim();
      resolve(isValidISO(v) ? v : null);
    };

    dlg.addEventListener("close", () => {
      if (_dateDialogResolver) {
        _dateDialogResolver(null);
        _dateDialogResolver = null;
      }
    }, { once: true });
  });
};

/* ===============================
   BOOT
================================ */
const boot = async () => {
  AppState = loadState();
  Audio.init();
  Audio.enabled = AppState.settings?.soundEnabled || false;

  setActiveRoute(getRouteFromHash());
  attachEvents();
  renderAll();

  const sync = document.getElementById("sync-status");
  if (sync) sync.textContent = "Pronto";
};

boot();
