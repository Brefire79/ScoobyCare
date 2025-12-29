// ScoobyCare — app.js (SPA + offline-first friendly)
// - Sem frameworks
// - Persistência local (localStorage)
// - Rotas por hash
// - Alertas na Home (vence / vencido)
// - Vacinas (carteira + reforços)

const STORAGE_KEY = "scoobycare_state_v1";
const ALERT_SOON_DAYS = 7;

let AppState = null;

/* -------------------------------
   Datas (SEM bug UTC no Brasil)
--------------------------------- */
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

/* -------------------------------
   Utilitários
--------------------------------- */
const generateId = (prefix) => `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;

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
  } catch {
    // silencioso
  }
};


/* -------------------------------
   Modal de Data (dose/ação)
--------------------------------- */
let _dateDialogResolver = null;

const isValidISO = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(String(iso||""));
const clampISO = (iso) => (isValidISO(iso) ? iso : todayISO());
const monthLabel = (year, monthIndex0) => {
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[monthIndex0]} ${year}`;
};
const daysInMonth = (y, m0) => new Date(y, m0 + 1, 0).getDate();

const openDateDialog = ({ title = "Selecionar data", sub = "Escolha a data do registro.", defaultISO = todayISO() } = {}) => {
  const dlg = document.getElementById("date-dialog");
  const input = document.getElementById("date-dialog-input");
  const t = document.getElementById("date-dialog-title");
  const s = document.getElementById("date-dialog-sub");
  const grid = document.getElementById("dp-grid");
  const monthEl = document.getElementById("dp-month");
  const prev = document.getElementById("dp-prev");
  const next = document.getElementById("dp-next");

  const fallback = () => {
    const raw = prompt(`${title}\n${sub}\n(YYYY-MM-DD)`, defaultISO);
    return Promise.resolve(raw || null);
  };

  if (!dlg || !input || !grid || !monthEl || !prev || !next) return fallback();

  t && (t.textContent = title);
  s && (s.textContent = sub);

  let selectedISO = clampISO(defaultISO);
  input.value = selectedISO;

  // mês em exibição
  let view = asLocalDate(selectedISO);
  view = new Date(view.getFullYear(), view.getMonth(), 1);

  const render = () => {
    const y = view.getFullYear();
    const m0 = view.getMonth();
    monthEl.textContent = monthLabel(y, m0);

    const firstDow = new Date(y, m0, 1).getDay(); // 0=dom
    const total = daysInMonth(y, m0);

    // grid 6 semanas * 7 = 42
    const cells = [];
    // dias do mês anterior para preencher
    const prevMonthDays = daysInMonth(y, m0 - 1 < 0 ? 11 : m0 - 1);
    for (let i = 0; i < firstDow; i++) {
      const day = prevMonthDays - (firstDow - 1 - i);
      cells.push({ y, m0: m0 - 1, day, muted: true });
    }
    for (let d = 1; d <= total; d++) cells.push({ y, m0, day: d, muted: false });
    while (cells.length < 42) {
      const idx = cells.length - (firstDow + total);
      cells.push({ y, m0: m0 + 1, day: idx + 1, muted: true });
    }

    const today = todayISO();
    const sel = selectedISO;

    grid.innerHTML = cells.map((c) => {
      const dt = new Date(c.y, c.m0, c.day);
      const yy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const iso = `${yy}-${mm}-${dd}`;
      const cls = [
        "dp-day",
        c.muted ? "muted" : "",
        iso === today ? "today" : "",
        iso === sel ? "selected" : ""
      ].filter(Boolean).join(" ");
      return `<button type="button" class="${cls}" data-iso="${iso}">${dt.getDate()}</button>`;
    }).join("");
  };

  const syncFromInput = () => {
    const v = (input.value || "").trim();
    if (!isValidISO(v)) return;
    selectedISO = v;
    view = asLocalDate(selectedISO);
    view = new Date(view.getFullYear(), view.getMonth(), 1);
    render();
  };

  const onGridClick = (e) => {
    const b = e.target.closest("button[data-iso]");
    if (!b) return;
    selectedISO = b.dataset.iso;
    input.value = selectedISO;
    render();
  };

  const onPrev = (e) => {
    e.preventDefault();
    view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
    render();
  };
  const onNext = (e) => {
    e.preventDefault();
    view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    render();
  };

  render();

  return new Promise((resolve) => {
    _dateDialogResolver = resolve;

    grid.addEventListener("click", onGridClick);
    prev.addEventListener("click", onPrev);
    next.addEventListener("click", onNext);
    input.addEventListener("change", syncFromInput);

    dlg.showModal();

    const onClose = () => {
      dlg.removeEventListener("close", onClose);

      grid.removeEventListener("click", onGridClick);
      prev.removeEventListener("click", onPrev);
      next.removeEventListener("click", onNext);
      input.removeEventListener("change", syncFromInput);

      const v = dlg.returnValue;
      if (v !== "ok") return resolve(null);

      const val = (input.value || "").trim();
      resolve(isValidISO(val) ? val : selectedISO);
    };

    dlg.addEventListener("close", onClose, { once: true });
  });
};

/* -------------------------------
   Alertas Sonoros (best-effort)
   Obs: navegador pode bloquear som
   sem interação do usuário.
--------------------------------- */
const BEEP_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="; // fallback curtinho

let _audioCtx = null;
const getAudioCtx = async () => {
  if (_audioCtx) return _audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  _audioCtx = new Ctx();
  if (_audioCtx.state === "suspended") {
    try { await _audioCtx.resume(); } catch {}
  }
  return _audioCtx;
};

const playTone = async (freq = 660, ms = 160) => {
  const ctx = await getAudioCtx();
  if (!ctx) {
    try {
      const a = new Audio(BEEP_WAV);
      a.volume = 0.9;
      await a.play();
      return true;
    } catch {
      return false;
    }
  }

  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ms / 1000));
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ms / 1000) + 0.02);
    return true;
  } catch {
    return false;
  }
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const patternFor = (kind) => {
  // sons diferentes por categoria (operacional e fácil de reconhecer)
  if (kind === "med") return [{ f: 520, d: 220 }, { gap: 90 }, { f: 520, d: 220 }];           // duplo grave
  if (kind === "vac") return [{ f: 880, d: 160 }, { gap: 70 }, { f: 1040, d: 160 }];         // duplo agudo
  if (kind === "routine") return [{ f: 740, d: 120 }, { gap: 70 }, { f: 740, d: 120 }, { gap: 70 }, { f: 740, d: 120 }]; // triplo
  return [{ f: 660, d: 160 }];
};

const playPattern = async (kind) => {
  const seq = patternFor(kind);
  let ok = false;
  for (const step of seq) {
    if (step.gap) { await sleep(step.gap); continue; }
    ok = (await playTone(step.f, step.d)) || ok;
    await sleep(40);
  }
  return ok;
};

const shouldPlaySoundFor = (events) => {
  const s = AppState.settings?.soundAlerts || {};
  if (!s.enabled) return { should: false, toPlay: [] };

  // urgentes = vencidos primeiro, depois vencendo
  const urgent = events
    .filter(e => e.date && (e.status.className === "late" || e.status.className === "soon"))
    .sort((a, b) => {
      const wa = a.status.className === "late" ? 0 : 1;
      const wb = b.status.className === "late" ? 0 : 1;
      if (wa !== wb) return wa - wb;
      return asLocalDate(a.date) - asLocalDate(b.date);
    });

  if (!urgent.length) return { should: false, toPlay: [] };

  const today = todayISO();
  s.lastPlayedByItemISO = s.lastPlayedByItemISO || {};

  const fresh = urgent.filter(e => s.lastPlayedByItemISO[e.id] !== today);

  if (!fresh.length) return { should: false, toPlay: [] };

  // toca no máx 3 itens por rodada
  return { should: true, toPlay: fresh.slice(0, 3) };
};

const maybePlaySoundAlerts = async (events) => {
  const s = AppState.settings?.soundAlerts || {};
  const verdict = shouldPlaySoundFor(events);
  if (!verdict.should) return;

  for (const e of verdict.toPlay) {
    const ok = await playPattern(e.kind);
    if (ok) {
      s.lastPlayedByItemISO = s.lastPlayedByItemISO || {};
      s.lastPlayedByItemISO[e.id] = todayISO();
      AppState.settings.soundAlerts = s;
      saveState();
      showToast(`🔔 Alerta: ${e.title}`);
      await sleep(180);
    }
  }
};

/* -------------------------------
   Exportar Calendário (.ics)
--------------------------------- */
const icsEscape = (s) =>
  String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");

const ymdToICSDate = (iso) => iso ? iso.replaceAll("-", "") : "";

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

const exportICSAll = () => {
  const pet = getPet();
  const events = collectUpcoming(pet).filter(e => e.date);
  // pega só os próximos 180 dias
  const limited = events.filter(e => {
    const diff = daysBetween(todayISO(), e.date);
    return diff >= -30 && diff <= 180; // inclui vencidos recentes e futuros próximos
  });
  const ics = buildICS(limited, "ScoobyCare — Alertas");
  downloadTextFile("scoobycare-alertas.ics", ics, "text/calendar");
  showToast("Calendário .ics exportado");
};


const getEventForICS = (kind, id) => {
  const pet = getPet();
  if (kind === "med") {
    const m = (pet.medications || []).find(x => x.id === id);
    if (!m) return null;
    const last = m.applications?.length ? m.applications[m.applications.length - 1].date : null;
    const next = last ? nextDateFrom(last, m.intervalDays) : null;
    return { kind, id, title: `${m.name}${m.doseLabel ? ` (${m.doseLabel})` : ""}`, detail: `Intervalo: ${m.intervalDays} dias`, date: next };
  }
  if (kind === "vac") {
    const v = (pet.vaccinations || []).find(x => x.id === id);
    if (!v) return null;
    const last = v.doses?.length ? v.doses[v.doses.length - 1] : null;
    const next = last ? nextDateFrom(last, v.intervalDays) : null;
    return { kind, id, title: `Vacina: ${v.name}`, detail: `Reforço: ${v.intervalDays} dias`, date: next };
  }
  if (kind === "routine") {
    const r = (pet.routines || []).find(x => x.id === id);
    if (!r) return null;
    const last = r.logs?.length ? r.logs[r.logs.length - 1].date : null;
    const lastLog = r.logs?.length ? r.logs[r.logs.length - 1] : null;
    const lastDate = lastLog?.date || null;
    const next = lastDate ? nextDateMonthsFrom(lastDate, r.everyMonths) : todayISO();
    return { kind, id, title: r.name, detail: `A cada ${r.everyMonths} mês(es)`, date: next };
  }
  return null;
};

const exportICSSingle = (kind, id) => {
  const evt = getEventForICS(kind, id);
  if (!evt || !evt.date) return showToast("Sem próxima data para exportar");
  const ics = buildICS([evt], "ScoobyCare — Evento");
  const safe = (evt.title || "evento").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  downloadTextFile(`scoobycare-${safe}.ics`, ics, "text/calendar");
  showToast(".ics exportado");
};


const computeStatus = (dueDate) => {
  if (!dueDate) return { label: "Sem data", className: "muted", diff: null };
  const diff = daysBetween(todayISO(), dueDate);

  if (diff < 0) return { label: `Vencido há ${Math.abs(diff)}d`, className: "late", diff };
  if (diff === 0) return { label: "Vence hoje", className: "soon", diff };
  if (diff <= ALERT_SOON_DAYS) return { label: `Vence em ${diff}d`, className: "soon", diff };
  return { label: `Falta ${diff}d`, className: "ok", diff };
};

/* -------------------------------
   Estado / Storage
--------------------------------- */


/* ------------------------------
   Modo Veterinário — Relatório (PDF via impressão)
   - Sem dependências: abre uma página de relatório e dispara window.print()
   - O usuário salva como PDF (Chrome/Edge/Android/ iOS)
--------------------------------- */
const buildVetReportHTML = () => {
  const state = AppState;
  const pet = getPet();
  const profile = pet.profile || {};
  const weights = (pet.weightRecords || []).slice().sort((a,b)=> (a.date<b.date?1:-1));
  const lastWeight = weights[0];
  const vaccines = (pet.vaccinations || []);
  const meds = (pet.medications || []);
  const routines = (pet.routines || []);
  const timeline = (pet.timeline || []).slice().sort((a,b)=> (a.date<b.date?1:-1));

  const line = (label, value) => `<div class="row"><div class="k">${label}</div><div class="v">${value ?? "—"}</div></div>`;
  const badge = (status) => status ? `<span class="badge ${status.className}">${status.label}</span>` : "";

  const vaccineRows = vaccines.length ? vaccines.map(v=>{
    const last = (v.doses || []).slice().sort().at(-1);
    const next = last ? nextDateFrom(last, v.intervalDays) : null;
    const st = computeStatus(next);
    return `<div class="item">
      <div class="item-h"><strong>${v.name}</strong> ${badge(st)}</div>
      <div class="item-b">Última: ${formatDate(last)} | Próxima: ${formatDate(next)} | Intervalo: ${v.intervalDays} dias</div>
    </div>`;
  }).join("") : `<div class="muted">Nenhuma vacina cadastrada.</div>`;

  const medsRows = meds.length ? meds.map(m=>{
    const last = (m.applications || []).map(a=>a.date).slice().sort().at(-1);
    const next = last ? nextDateFrom(last, m.intervalDays) : null;
    const st = computeStatus(next);
    return `<div class="item">
      <div class="item-h"><strong>${m.name}</strong> (${m.doseLabel || "—"}) ${badge(st)}</div>
      <div class="item-b">Última: ${formatDate(last)} | Próxima: ${formatDate(next)} | Intervalo: ${m.intervalDays} dias</div>
    </div>`;
  }).join("") : `<div class="muted">Nenhum medicamento cadastrado.</div>`;

  const routineRows = routines.length ? routines.map(r=>{
    const last = (r.logs || []).map(x=>x.date).slice().sort().at(-1);
    const next = last ? nextDateMonthsFrom(last, r.everyMonths || 1) : todayISO();
    const st = computeStatus(next);
    return `<div class="item">
      <div class="item-h"><strong>${r.name}</strong> ${badge(st)}</div>
      <div class="item-b">Última: ${formatDate(last)} | Próxima: ${formatDate(next)} | A cada ${r.everyMonths || 1} mês(es)</div>
    </div>`;
  }).join("") : `<div class="muted">Nenhuma rotina cadastrada.</div>`;

  const food = pet.food?.current?.text || "—";
  const foodSince = pet.food?.current?.since || null;

  const tlRows = timeline.slice(0, 20).map(t=>{
    const d = formatDate(t.date);
    const title = t.title || t.type || "Evento";
    const detail = t.detail || "";
    return `<li><strong>${d}</strong> — ${title}${detail ? `: ${detail}` : ""}</li>`;
  }).join("") || "<li class='muted'>Sem registros.</li>";

  const now = new Date();
  const printedAt = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Relatório Veterinário — ${profile.name || "Pet"}</title>
<style>
  :root{
    --bg:#0b1020; --card:#121a33; --text:#e9edff; --muted:#a9b3d9;
    --ok:#1bd96a; --soon:#ffbf3c; --late:#ff4d6d; --line:rgba(255,255,255,.12);
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu; background:#fff; color:#111;}
  .page{padding:22px; max-width:900px; margin:0 auto;}
  h1{margin:0 0 4px 0; font-size:22px}
  .sub{color:#444; margin:0 0 14px 0; font-size:13px}
  .grid{display:grid; grid-template-columns:1fr 1fr; gap:12px}
  .card{border:1px solid #ddd; border-radius:14px; padding:14px}
  .row{display:flex; justify-content:space-between; gap:12px; padding:6px 0; border-bottom:1px solid #eee}
  .row:last-child{border-bottom:none}
  .k{color:#444; font-size:12px}
  .v{font-weight:600; font-size:12px}
  .section-title{margin:16px 0 8px; font-size:14px}
  .item{border:1px solid #eee; border-radius:12px; padding:10px; margin:8px 0}
  .item-h{display:flex; gap:10px; align-items:center; justify-content:space-between}
  .item-b{color:#444; font-size:12px; margin-top:6px}
  .badge{padding:4px 8px; border-radius:999px; font-size:11px; border:1px solid #ddd; white-space:nowrap}
  .badge.ok{background:#eafff1; border-color:#b8f2cb}
  .badge.soon{background:#fff6df; border-color:#ffe0a3}
  .badge.late{background:#ffe8ee; border-color:#ffb3c2}
  .badge.muted{background:#f4f4f4}
  ul{margin:8px 0 0 18px; padding:0}
  li{margin:6px 0; font-size:12px}
  .muted{color:#777; font-size:12px}
  .print-note{margin-top:14px; color:#666; font-size:11px}
  @media print{
    body{background:#fff}
    .page{padding:0}
    .card,.item{break-inside:avoid}
  }
</style>
</head>
<body>
  <div class="page">
    <h1>Relatório Veterinário — ${profile.name || "Pet"}</h1>
    <p class="sub">Gerado em ${printedAt} • ScoobyCare</p>

    <div class="grid">
      <div class="card">
        <div class="section-title">Identificação</div>
        ${line("Raça", profile.breed)}
        ${line("Nascimento", formatDate(profile.birthDate))}
        ${line("Castração", formatDate(profile.neuteredDate))}
        ${line("Observações", profile.notes || "—")}
      </div>
      <div class="card">
        <div class="section-title">Resumo rápido</div>
        ${line("Último peso", lastWeight ? `${lastWeight.kg.toFixed(2)} kg (${formatDate(lastWeight.date)})` : "—")}
        ${line("Alimentação atual", food)}
        ${line("Desde", formatDate(foodSince))}
      </div>
    </div>

    <div class="section-title">Vacinas</div>
    <div class="card">${vaccineRows}</div>

    <div class="section-title">Medicamentos / Parasitas</div>
    <div class="card">${medsRows}</div>

    <div class="section-title">Rotinas</div>
    <div class="card">${routineRows}</div>

    <div class="section-title">Histórico recente</div>
    <div class="card">
      <ul>${tlRows}</ul>
    </div>

    <p class="print-note">Dica: no diálogo de impressão, escolha “Salvar como PDF”.</p>
  </div>
<script>
  // aguarda render e abre impressão
  window.addEventListener('load', () => setTimeout(()=>window.print(), 250));
</script>
</body>
</html>`;
};

const openVetReportAndPrint = () => {
  const html = buildVetReportHTML();
  const w = window.open("", "_blank");
  if (!w) {
    alert("Seu navegador bloqueou o pop-up. Permita pop-ups para gerar o PDF.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
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
        notes: "Setembro/2025: Benaflora por fezes moles (resolvido)."
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
            { id: "a_2025-09-18", date: "2025-09-18", note: "" },
            { id: "a_2025-12-17", date: "2025-12-17", note: "" }
          ]
        }
      ],
      vaccinations: [
        // você pode editar/ajustar depois
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
          text: "150 g de Biofresh (castrados) + 90 g de legumes (chuchu/quiabo) à noite.",
          notes: ""
        },
        history: [
          { id: "food_2025-09-19", date: "2025-09-19", text: "150 g de Biofresh (castrados) + 90 g de legumes (chuchu/quiabo) à noite.", notes: "" }
        ]
      },
      timeline: [
        { id: "t_benaflora_2025-09", date: "2025-09-01", type: "saúde", title: "Benaflora", detail: "Uso em Setembro/2025 por fezes moles (resolvido)." }
      ]
    }
  ],
  settings: { notifications: { enabled: true }, soundAlerts: { enabled: false, lastPlayedISO: null, unlocked: false } }
});

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

/* -------------------------------
   Rotas
--------------------------------- */
const setActiveRoute = (route) => {
  document.querySelectorAll(".view").forEach((v) => {
    const name = v.getAttribute("data-view");
    v.classList.toggle("hidden", name !== route);
  });

  document.querySelectorAll(".tab-link").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === route);
  });
};

const getRouteFromHash = () => {
  const h = (location.hash || "#home").replace("#", "");
  const allowed = ["home", "peso", "meds", "vaccines", "routines", "food", "history", "settings", "alerts"];
  return allowed.includes(h) ? h : "home";
};

/* -------------------------------
   Coleta de eventos (Home)
--------------------------------- */
const collectUpcoming = (pet) => {
  const list = [];

  // Medicamentos
  (pet.medications || []).forEach((m) => {
    const last = m.applications?.length ? m.applications[m.applications.length - 1].date : null;
    const next = last ? nextDateFrom(last, m.intervalDays) : null;
    list.push({
      kind: "med",
      id: m.id,
      title: `${m.name}${m.doseLabel ? ` (${m.doseLabel})` : ""}`,
      detail: `Intervalo: ${m.intervalDays} dias`,
      date: next
    });
  });

  // Vacinas
  (pet.vaccinations || []).forEach((v) => {
    const last = v.doses?.length ? v.doses[v.doses.length - 1] : null;
    const next = last ? nextDateFrom(last, v.intervalDays) : null;
    list.push({
      kind: "vac",
      id: v.id,
      title: `Vacina: ${v.name}`,
      detail: `Reforço: ${v.intervalDays} dias`,
      date: next
    });
  });

  // Rotinas
  (pet.routines || []).forEach((r) => {
    const lastLog = r.logs?.length ? r.logs[r.logs.length - 1] : null;
    const lastDate = lastLog?.date || null;
    const next = lastDate ? nextDateMonthsFrom(lastDate, r.everyMonths) : todayISO();
    list.push({
      kind: "routine",
      id: r.id,
      title: r.name,
      detail: `A cada ${r.everyMonths} mês(es)`,
      date: next
    });
  });

  // status + ordenação
  return list
    .map((e) => ({ ...e, status: computeStatus(e.date) }))
    .sort((a, b) => {
      // sem data vai pro final
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return asLocalDate(a.date) - asLocalDate(b.date);
    });
};

/* -------------------------------
   Renderizações
--------------------------------- */
const renderHomeAlerts = (events) => {
  const el = document.getElementById("home-alerts");
  if (!el) return;

  const late = events.filter((e) => e.status.className === "late");
  const soon = events.filter((e) => e.status.className === "soon");
  const ok = events.filter((e) => e.status.className === "ok");

  const title = late.length
    ? `🚨 ${late.length} pendência(s) vencida(s)`
    : soon.length
      ? `⏰ ${soon.length} coisa(s) vencendo logo`
      : `✅ Tudo em dia`;

  const pick = (arr) => arr.slice(0, 4).map(e => `• ${e.title} — ${e.status.label}`).join("<br>");
  const details = late.length ? pick(late) : soon.length ? pick(soon) : `• ${ok.length} item(ns) monitorado(s)`;

  el.innerHTML = `
    <h2>Alertas</h2>
    <p><strong>${title}</strong></p>
    <p class="small-text">${details}</p>
  `;
};

const renderHome = () => {
  const pet = getPet();
  const events = collectUpcoming(pet);

  // hero
  const lastW = pet.weightRecords?.length ? pet.weightRecords[pet.weightRecords.length - 1] : null;
  const heroWeight = document.getElementById("hero-weight");
  if (heroWeight) {
    heroWeight.textContent = lastW
      ? `Último peso: ${lastW.kg.toFixed(2)} kg (${formatDate(lastW.date)})`
      : "Último peso: —";
  }

  const nextEvt = events.find((e) => e.date) || null;

/* -------------------------------
   Central de Pendências (Painel)
--------------------------------- */
let _alertsFilter = "all";

const renderAlerts = () => {
  const pet = getPet();
  const events = collectUpcoming(pet);
  const listEl = document.getElementById("alerts-list");
  const sumEl = document.getElementById("alerts-summary");
  if (!listEl) return;

  const late = events.filter(e => e.status.className === "late");
  const soon = events.filter(e => e.status.className === "soon");
  const ok = events.filter(e => e.status.className === "ok");

  const filterFn = (e) => {
    if (_alertsFilter === "all") return true;
    return e.status.className === _alertsFilter;
  };

  const filtered = events.filter(filterFn);

  if (sumEl) {
    sumEl.innerHTML = `
      <strong>${late.length}</strong> vencido(s) ·
      <strong>${soon.length}</strong> vencendo ·
      <strong>${ok.length}</strong> em dia
      <span class="muted"> · mostrando: ${_alertsFilter === "all" ? "tudo" : _alertsFilter}</span>
    `;
  }

  const actionLabel = (e) => {
    if (e.kind === "routine") return "Marcar feito";
    return "Registrar dose";
  };

  const html = filtered.map((e) => {
    const badge = `<span class="badge ${e.status.className}">${e.status.label}</span>`;
    const date = e.date ? formatDate(e.date) : "—";
    const icsBtn = e.date ? `<button class="btn" data-ics-one="${e.kind}:${e.id}">📅 .ics</button>` : "";
    return `
      <div class="card">
        <h2>${e.title}</h2>
        <p class="small-text">${e.detail}</p>
        <p>Próxima: <strong>${date}</strong></p>
        <div class="actions-row">
          ${badge}
          <div class="actions-row" style="gap:8px">
            ${icsBtn}
            <button class="btn primary" data-do-action="${e.kind}:${e.id}">${actionLabel(e)}</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  listEl.innerHTML = html || `<p class="small-text">Nada por aqui 🎉</p>`;
};

  const heroNext = document.getElementById("hero-next");
  if (heroNext) heroNext.textContent = `Próximo: ${nextEvt ? `${nextEvt.title} (${formatDate(nextEvt.date)})` : "—"}`;

  const profile = document.getElementById("home-profile");
  if (profile) {
    const p = pet.profile;
    profile.innerHTML = `
      <div><strong>${p.name}</strong></div>
      <div>${p.breed} • Nasc: ${formatDate(p.birthDate)} • Castração: ${formatDate(p.neuteredDate)}</div>
      <div style="margin-top:8px">${p.notes || ""}</div>
    `;
  }

  renderHomeAlerts(events);
  maybePlaySoundAlerts(events);

  const upcoming = document.getElementById("home-upcoming");
  if (upcoming) {
    if (!events.length) {
      upcoming.innerHTML = `<div class="small-text">Nenhum evento cadastrado.</div>`;
    } else {
      upcoming.innerHTML = events.slice(0, 10).map((e) => `
        <div class="list-item">
          <div class="list-main">
            <div class="list-title">${e.title}</div>
            <div class="list-sub">${e.detail}</div>
          </div>
          <div class="list-right">
            <span class="badge ${e.status.className}">${e.status.label}</span>
            <div class="small-text">${formatDate(e.date)}</div>
            <button class="btn tiny secondary" data-ics-kind="${e.kind}" data-ics-id="${e.id}" aria-label="Exportar .ics">📅</button>
          </div>
        </div>
      `).join("");
    }
  }
};

const renderWeights = () => {
  const pet = getPet();
  const listEl = document.getElementById("weight-list");
  if (!listEl) return;

  const items = [...(pet.weightRecords || [])].sort((a,b)=> asLocalDate(b.date)-asLocalDate(a.date));
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

const renderMeds = () => {
  const pet = getPet();
  const container = document.getElementById("med-list");
  if (!container) return;

  const meds = pet.medications || [];
  container.innerHTML = meds.length ? meds.map((m) => {
    const last = m.applications?.length ? m.applications[m.applications.length - 1].date : null;
    const next = last ? nextDateFrom(last, m.intervalDays) : null;
    const status = computeStatus(next);

    return `
      <div class="card">
        <h2>${m.name}</h2>
        <p class="small-text">${m.doseLabel ? `${m.doseLabel} • ` : ""}Intervalo: ${m.intervalDays} dias</p>
        <div class="actions-row" style="justify-content:space-between; margin-top:10px">
          <span class="badge ${status.className}">${status.label}</span>
          <div class="actions-row">
            <button class="btn primary" data-med-apply="${m.id}">Registrar dose</button>
            <button class="btn secondary" data-ics-kind="med" data-ics-id="${m.id}">📅 .ics</button>
            <button class="btn" data-med-del="${m.id}">Excluir</button>
          </div>
        </div>
        <p class="small-text" style="margin-top:10px">Última: ${formatDate(last)} • Próxima: ${formatDate(next)}</p>
      </div>
    `;
  }).join("") : `<div class="small-text">Nenhum medicamento cadastrado.</div>`;
};

const renderVaccines = () => {
  const pet = getPet();
  const container = document.getElementById("vaccines-list");
  if (!container) return;

  const vacs = pet.vaccinations || [];
  container.innerHTML = vacs.length ? vacs.map((v) => {
    const last = v.doses?.length ? v.doses[v.doses.length - 1] : null;
    const next = last ? nextDateFrom(last, v.intervalDays) : null;
    const status = computeStatus(next);

    return `
      <div class="card">
        <h2>${v.name}</h2>
        <p class="small-text">Reforço: ${v.intervalDays} dias</p>
        <div class="actions-row" style="justify-content:space-between; margin-top:10px">
          <span class="badge ${status.className}">${status.label}</span>
          <div class="actions-row">
            <button class="btn primary" data-vac-dose="${v.id}">Registrar dose</button>
            <button class="btn secondary" data-ics-kind="vac" data-ics-id="${v.id}">📅 .ics</button>
            <button class="btn" data-vac-del="${v.id}">Excluir</button>
          </div>
        </div>
        <p class="small-text" style="margin-top:10px">Última: ${formatDate(last)} • Próxima: ${formatDate(next)}</p>
      </div>
    `;
  }).join("") : `<div class="small-text">Nenhuma vacina cadastrada.</div>`;
};

const renderRoutines = () => {
  const pet = getPet();
  const container = document.getElementById("routine-list");
  if (!container) return;

  const routines = pet.routines || [];
  container.innerHTML = routines.length ? routines.map((r) => {
    const lastLog = r.logs?.length ? r.logs[r.logs.length - 1] : null;
    const lastDate = lastLog?.date || null;
    const next = lastDate ? nextDateMonthsFrom(lastDate, r.everyMonths) : todayISO();
    const status = computeStatus(next);

    return `
      <div class="card">
        <h2>${r.name}</h2>
        <p class="small-text">A cada ${r.everyMonths} mês(es)</p>
        <div class="actions-row" style="justify-content:space-between; margin-top:10px">
          <span class="badge ${status.className}">${status.label}</span>
          <div class="actions-row">
            <button class="btn primary" data-rt-done="${r.id}">Marcar feito</button>
            <button class="btn secondary" data-ics-kind="routine" data-ics-id="${r.id}">📅 .ics</button>
            <button class="btn" data-rt-del="${r.id}">Excluir</button>
          </div>
        </div>
        <p class="small-text" style="margin-top:10px">Última: ${formatDate(lastDate)} • Próxima: ${formatDate(next)}</p>
      </div>
    `;
  }).join("") : `<div class="small-text">Nenhuma rotina cadastrada.</div>`;
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
      ${c.notes ? `<div style="margin-top:8px" class="small-text">${c.notes}</div>` : ""}
    ` : `<div class="small-text">Sem alimentação cadastrada.</div>`;
  }
  if (history) {
    const h = [...(pet.food?.history || [])].sort((a,b)=> asLocalDate(b.date)-asLocalDate(a.date));
    history.innerHTML = h.length ? h.map(x => `
      <div class="list-item">
        <div class="list-main">
          <div class="list-title">${formatDate(x.date)}</div>
          <div class="list-sub">${x.text}</div>
          ${x.notes ? `<div class="list-sub">${x.notes}</div>` : ""}
        </div>
      </div>
    `).join("") : `<div class="small-text">Sem histórico ainda.</div>`;
  }

  // preencher form com atual
  const foodText = document.getElementById("food-text");
  const foodNotes = document.getElementById("food-notes");
  if (foodText && pet.food?.current?.text) foodText.value = pet.food.current.text;
  if (foodNotes && pet.food?.current?.notes) foodNotes.value = pet.food.current.notes;
};

const renderTimeline = () => {
  const pet = getPet();
  const el = document.getElementById("timeline");
  if (!el) return;

  const items = [...(pet.timeline || [])].sort((a,b)=> asLocalDate(b.date)-asLocalDate(a.date));
  el.innerHTML = items.length ? items.map(t => `
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${t.title}</div>
        <div class="list-sub">${formatDate(t.date)} • ${t.type}</div>
        <div class="list-sub">${t.detail || ""}</div>
      </div>
    </div>
  `).join("") : `<div class="small-text">Sem eventos ainda.</div>`;
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

/* -------------------------------
   Eventos / Ações
--------------------------------- */
const attachEvents = () => {
  // peso
  document.getElementById("weight-date").value = todayISO();
  document.getElementById("weight-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = document.getElementById("weight-date").value;
    const kg = Number(document.getElementById("weight-kg").value);
    const note = document.getElementById("weight-note").value.trim();

    if (!date || !Number.isFinite(kg) || kg <= 0) return;

    const pet = getPet();
    pet.weightRecords = pet.weightRecords || [];
    pet.weightRecords.push({ id: generateId("w"), date, kg, note });

    pushTimeline({ date, type: "peso", title: "Peso registrado", detail: `${kg.toFixed(2)} kg${note ? ` • ${note}` : ""}` });

    saveState();
    renderAll();
    showToast("Peso salvo");
    e.target.reset();
    document.getElementById("weight-date").value = todayISO();
  });

  document.getElementById("weight-list")?.addEventListener("click", (e) => {
    const pet = getPet();

    const del = e.target.closest("button[data-del-weight]");
    if (del) {
      const id = del.dataset.delWeight;
      pet.weightRecords = (pet.weightRecords || []).filter(w => w.id !== id);
      saveState();
      renderAll();
      showToast("Registro removido");
      return;
    }

    const edit = e.target.closest("button[data-edit-weight]");
    if (edit) {
      const id = edit.dataset.editWeight;
      const w = (pet.weightRecords || []).find(x => x.id === id);
      if (!w) return;

      const newKg = prompt("Novo peso (kg):", String(w.kg));
      if (newKg === null) return;
      const kg = Number(newKg);
      if (!Number.isFinite(kg) || kg <= 0) return showToast("Peso inválido");

      const newNote = prompt("Observação (opcional):", w.note || "");
      w.kg = kg;
      w.note = (newNote ?? "").trim();

      pushTimeline({ date: todayISO(), type: "peso", title: "Peso editado", detail: `${kg.toFixed(2)} kg` });

      saveState();
      renderAll();
      showToast("Peso atualizado");
    }
  });

  // meds add
  document.getElementById("med-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("med-name").value.trim();
    const doseLabel = document.getElementById("med-dose").value.trim();
    const intervalDays = Number(document.getElementById("med-interval").value);

    if (!name || !Number.isFinite(intervalDays) || intervalDays <= 0) return;

    const pet = getPet();
    pet.medications = pet.medications || [];
    pet.medications.push({ id: generateId("med"), name, doseLabel, intervalDays, applications: [] });

    saveState();
    renderAll();
    showToast("Medicamento adicionado");
    e.target.reset();
  });

  document.getElementById("med-list")?.addEventListener("click", async (e) => {
    const pet = getPet();

    const ics = e.target.closest("button[data-ics-kind]");
    if (ics) {
      exportICSSingle(ics.dataset.icsKind, ics.dataset.icsId);
      return;
    }

    const apply = e.target.closest("button[data-med-apply]");
    if (apply) {
      const id = apply.dataset.medApply;
      const m = (pet.medications || []).find(x => x.id === id);
      if (!m) return;

      const date = await openDateDialog({
        title: `${m.name} — registrar aplicação`,
        sub: "Escolha a data em que você aplicou (pode ser hoje ou retroativo).",
        defaultISO: todayISO()
      });
      if (!date) return;

      m.applications = m.applications || [];
      m.applications.push({ id: generateId("a"), date, note: "" });

      pushTimeline({ date, type: "medicação", title: `${m.name} aplicado`, detail: `${m.doseLabel || ""}`.trim() });

      saveState();
      renderAll();
      showToast("Aplicação registrada");
      notify(`${m.name} registrado. Próxima em ${formatDate(nextDateFrom(date, m.intervalDays))}`);
      return;
    }

    const del = e.target.closest("button[data-med-del]");
    if (del) {
      const id = del.dataset.medDel;
      pet.medications = (pet.medications || []).filter(x => x.id !== id);
      saveState();
      renderAll();
      showToast("Removido");
    }
  });

  // vacinas add
  document.getElementById("vaccine-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("vaccine-name").value.trim();
    const intervalDays = Number(document.getElementById("vaccine-interval").value);
    if (!name || !Number.isFinite(intervalDays) || intervalDays <= 0) return;

    const pet = getPet();
    pet.vaccinations = pet.vaccinations || [];
    pet.vaccinations.push({ id: generateId("vac"), name, intervalDays, doses: [] });

    saveState();
    renderAll();
    showToast("Vacina adicionada");
    e.target.reset();
  });

  document.getElementById("vaccines-list")?.addEventListener("click", async (e) => {
    const pet = getPet();

    const ics = e.target.closest("button[data-ics-kind]");
    if (ics) {
      exportICSSingle(ics.dataset.icsKind, ics.dataset.icsId);
      return;
    }

    const dose = e.target.closest("button[data-vac-dose]");
    if (dose) {
      const id = dose.dataset.vacDose;
      const v = (pet.vaccinations || []).find(x => x.id === id);
      if (!v) return;

      const date = await openDateDialog({
        title: `${v.name} — registrar dose`,
        sub: "Escolha a data da dose (pode ser hoje ou retroativo).",
        defaultISO: todayISO()
      });
      if (!date) return;

      v.doses = v.doses || [];
      v.doses.push(date);

      pushTimeline({ date, type: "vacina", title: `${v.name} aplicada`, detail: `Dose em ${formatDate(date)}` });

      saveState();
      renderAll();
      showToast("Dose registrada");
      notify(`Vacina registrada: ${v.name}. Próxima em ${formatDate(nextDateFrom(date, v.intervalDays))}`);
      return;
    }

    const del = e.target.closest("button[data-vac-del]");
    if (del) {
      const id = del.dataset.vacDel;
      pet.vaccinations = (pet.vaccinations || []).filter(x => x.id !== id);
      saveState();
      renderAll();
      showToast("Removido");
    }
  });

  // rotinas add
  document.getElementById("routine-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("routine-name").value.trim();
    const everyMonths = Number(document.getElementById("routine-every").value);
    if (!name || !Number.isFinite(everyMonths) || everyMonths <= 0) return;

    const pet = getPet();
    pet.routines = pet.routines || [];
    pet.routines.push({ id: generateId("rt"), name, everyMonths, logs: [] });

    saveState();
    renderAll();
    showToast("Rotina adicionada");
    e.target.reset();
  });

  document.getElementById("routine-list")?.addEventListener("click", async (e) => {
    const pet = getPet();

    const ics = e.target.closest("button[data-ics-kind]");
    if (ics) {
      exportICSSingle(ics.dataset.icsKind, ics.dataset.icsId);
      return;
    }

    const done = e.target.closest("button[data-rt-done]");
    if (done) {
      const id = done.dataset.rtDone;
      const r = (pet.routines || []).find(x => x.id === id);
      if (!r) return;

      const date = await openDateDialog({
        title: `${r.name} — marcar feito`,
        sub: "Escolha a data em que você fez essa rotina.",
        defaultISO: todayISO()
      });
      if (!date) return;

      r.logs = r.logs || [];
      r.logs.push({ id: generateId("log"), date, note: "" });

      pushTimeline({ date, type: "rotina", title: `${r.name} feito`, detail: "" });

      saveState();
      renderAll();
      showToast("Rotina registrada");
      notify(`Rotina registrada: ${r.name}. Próxima em ${formatDate(nextDateMonthsFrom(date, r.everyMonths))}`);
      return;
    }

    const del = e.target.closest("button[data-rt-del]");
    if (del) {
      const id = del.dataset.rtDel;
      pet.routines = (pet.routines || []).filter(x => x.id !== id);
      saveState();
      renderAll();
      showToast("Removido");
    }
  });

  // food
  document.getElementById("food-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = document.getElementById("food-text").value.trim();
    const notes = document.getElementById("food-notes").value.trim();
    if (!text) return;

    const pet = getPet();
    pet.food = pet.food || { current: null, history: [] };
    const date = await openDateDialog({ title: "Registrar alimentação", sub: "Escolha a data desta alteração na alimentação.", defaultISO: todayISO() });
    if (!date) return;

    pet.food.current = { since: date, text, notes };
    pet.food.history = pet.food.history || [];
    pet.food.history.push({ id: generateId("food"), date, text, notes });

    pushTimeline({ date, type: "alimentação", title: "Alimentação atualizada", detail: text });

    saveState();
    renderAll();
    showToast("Alimentação salva");
  });

  
  // calendário (.ics) e som
  document.getElementById("home-upcoming")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-ics-kind]");
    if (!btn) return;
    exportICSSingle(btn.dataset.icsKind, btn.dataset.icsId);
  });

  document.getElementById("btn-ics-all")?.addEventListener("click", () => {
    exportICSAll();
  });

  document.getElementById("btn-vet-pdf")?.addEventListener("click", () => {
    openVetReportAndPrint();
  });


  const soundToggle = document.getElementById("toggle-sound");
  if (soundToggle) {
    soundToggle.checked = !!AppState.settings?.soundAlerts?.enabled;
    soundToggle.addEventListener("change", async () => {
      AppState.settings.soundAlerts.enabled = !!soundToggle.checked;
      saveState();
      showToast(AppState.settings.soundAlerts.enabled ? "Alertas sonoros ativados" : "Alertas sonoros desativados");
      if (AppState.settings.soundAlerts.enabled) {
        const ok = await playBeep();
        if (ok) {
          AppState.settings.soundAlerts.unlocked = true;
          AppState.settings.soundAlerts.lastPlayedISO = todayISO();
          saveState();
        } else {
          showToast("Seu navegador bloqueou som automático. Use 'Testar som'.");
        }
      }
    });
  }

  document.getElementById("btn-sound-test")?.addEventListener("click", async () => {
    const ok = await playBeep();
    if (ok) {
      AppState.settings.soundAlerts.unlocked = true;
      saveState();
      showToast("Som OK ✅");
    } else {
      showToast("Som bloqueado. Tente tocar na tela e testar de novo.");
    }
  });

// export / import
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
      if (!parsed?.pets?.length) throw new Error("Arquivo inválido");
      AppState = parsed;
      saveState();
      renderAll();
      showToast("Importado com sucesso");
    } catch {
      showToast("Falha ao importar");
    } finally {
      e.target.value = "";
    }
  });

  document.getElementById("btn-notify")?.addEventListener("click", async () => {
    await notify("Teste de notificação: ScoobyCare tá vivo 🐶⚡");
    showToast("Notificação solicitada");
  });

  // status online/offline
  const updateOnline = () => {
    const el = document.getElementById("online-status");
    if (!el) return;
    const online = navigator.onLine;
    el.textContent = online ? "Online" : "Offline";
    el.classList.toggle("online", online);
    el.classList.toggle("offline", !online);
  };
  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);
  updateOnline();

  // rotas
  window.addEventListener("hashchange", () => {
    setActiveRoute(getRouteFromHash());
  });
  // Central de Pendências (filtros + ações)
  document.querySelectorAll("[data-alert-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-alert-filter]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      _alertsFilter = btn.dataset.alertFilter || "all";
      renderAlerts();
    });
  });

  document.getElementById("alerts-list")?.addEventListener("click", async (e) => {
    const a = e.target.closest("[data-do-action]");
    if (a) {
      const [kind, id] = (a.dataset.doAction || "").split(":");
      if (!kind || !id) return;

      const picked = await openDateDialog({
        title: kind === "routine" ? "Marcar rotina como feita" : "Registrar dose",
        sub: "Escolha a data real do ocorrido (pode ser hoje ou retroativo).",
        defaultISO: todayISO()
      });
      if (!picked) return;

      if (kind === "med") {
        const pet = getPet();
        const med = (pet.medications || []).find(x => x.id === id);
        if (!med) return;
        med.applications = med.applications || [];
        med.applications.push({ id: generateId("app"), date: picked, note: "" });
        pushTimeline({ date: picked, type: "med", title: `${med.name} aplicado`, detail: `Dose em ${formatDate(picked)}` });
        saveState(); renderAll(); notify(`Dose registrada: ${med.name}`);
      } else if (kind === "vac") {
        const pet = getPet();
        const vac = (pet.vaccinations || []).find(x => x.id === id);
        if (!vac) return;
        vac.doses = vac.doses || [];
        vac.doses.push(picked);
        pushTimeline({ date: picked, type: "vacina", title: `${vac.name} aplicada`, detail: `Dose em ${formatDate(picked)}` });
        saveState(); renderAll(); notify(`Vacina registrada: ${vac.name}`);
      } else if (kind === "routine") {
        const pet = getPet();
        const rt = (pet.routines || []).find(x => x.id === id);
        if (!rt) return;
        rt.logs = rt.logs || [];
        rt.logs.push({ id: generateId("log"), date: picked, note: "" });
        pushTimeline({ date: picked, type: "rotina", title: `${rt.name} feita`, detail: `Marcado em ${formatDate(picked)}` });
        saveState(); renderAll(); notify(`Rotina feita: ${rt.name}`);
      }
      return;
    }

    const b = e.target.closest("[data-ics-one]");
    if (b) {
      const [kind, id] = (b.dataset.icsOne || "").split(":");
      exportICSSingle(kind, id);
    }
  });

};

/* -------------------------------
   Service Worker
--------------------------------- */
const registerSW = async () => {
  try {
    if ("serviceWorker" in navigator) {
      await navigator.serviceWorker.register("./sw.js");
    }
  } catch {
    // ignore
  }
};

/* -------------------------------
   Boot
--------------------------------- */
const boot = async () => {
  AppState = loadState();
  setActiveRoute(getRouteFromHash());
  attachEvents();
  renderAll();

  // checagem periódica de alertas (som + status) enquanto o app estiver aberto
  window.clearInterval(boot._alertTick);
  boot._alertTick = window.setInterval(() => {
    try {
      const evts = collectUpcoming(getPet());
      maybePlaySoundAlerts(evts);
    } catch {}
  }, 60000);
  await registerSW();

  // marca salvo
  const sync = document.getElementById("sync-status");
  if (sync) sync.textContent = "Salvo";
};

boot();