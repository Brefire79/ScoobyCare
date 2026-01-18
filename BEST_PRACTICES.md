# 🎯 BOAS PRÁTICAS PARA EVITAR DUPLICIDADES NO ScoobyCare

## 📋 Índice
1. [Princípios de Design](#princípios)
2. [Padrões de Código](#padrões)
3. [Checklist de Revisão](#checklist)
4. [Exemplos Práticos](#exemplos)

---

## 🏗️ Princípios de Design {#princípios}

### 1. **DRY - Don't Repeat Yourself**

**❌ ERRADO:**
```javascript
// Medicamentos
const renderMeds = () => {
  const pet = getPet();
  const list = [];
  for (const m of pet.medications) {
    const last = m.applications?.length ? m.applications[m.applications.length - 1] : null;
    const next = last ? nextDateFrom(last, m.intervalDays) : null;
    list.push({ ...m, next });
  }
  // render...
};

// Vacinas - MESMA LÓGICA
const renderVaccines = () => {
  const pet = getPet();
  const list = [];
  for (const v of pet.vaccinations) {
    const last = v.doses?.length ? v.doses[v.doses.length - 1] : null;
    const next = last ? nextDateFrom(last, v.intervalDays) : null;
    list.push({ ...v, next });
  }
  // render...
};

// Rotinas - NOVAMENTE
const renderRoutines = () => {
  const pet = getPet();
  const list = [];
  for (const r of pet.routines) {
    const last = r.logs?.length ? r.logs[r.logs.length - 1]?.date : null;
    const next = last ? nextDateMonthsFrom(last, r.everyMonths) : null;
    list.push({ ...r, next });
  }
  // render...
};
```

**✅ CORRETO:**
```javascript
// Criar uma função genérica
const getNextDate = (item) => {
  if (item.kind === "med") {
    const lastApp = item.applications?.length 
      ? item.applications[item.applications.length - 1].date : null;
    return lastApp ? nextDateFrom(lastApp, item.intervalDays) : null;
  }
  if (item.kind === "vac") {
    const lastDose = item.doses?.length ? item.doses[item.doses.length - 1] : null;
    return lastDose ? nextDateFrom(lastDose, item.intervalDays) : null;
  }
  if (item.kind === "routine") {
    const lastLog = item.logs?.length ? item.logs[item.logs.length - 1] : null;
    return lastLog?.date ? nextDateMonthsFrom(lastLog.date, item.everyMonths) : null;
  }
  return null;
};

// Usar em todos os lugares
const computeItemWithNextDate = (item) => ({
  ...item,
  next: getNextDate(item),
  status: computeStatus(getNextDate(item))
});

const renderMeds = () => renderItemList(getPet().medications, "med-list");
const renderVaccines = () => renderItemList(getPet().vaccinations, "vaccines-list");
const renderRoutines = () => renderItemList(getPet().routines, "routine-list");

const renderItemList = (items, containerId) => {
  const container = document.getElementById(containerId);
  if (!container) return;
  const withDates = items.map(computeItemWithNextDate);
  container.innerHTML = withDates.length 
    ? withDates.map(renderItemCard).join("")
    : `<div class="small-text">Nenhum item cadastrado</div>`;
};
```

---

### 2. **SOLID - Single Responsibility**

Cada função deve ter **UMA** responsabilidade clara.

**❌ ERRADO:**
```javascript
// Esta função faz 5 coisas!
const handleItemAction = (e) => {
  const target = e.target;
  
  // 1. Encontrar elemento
  const btn = target.closest("button");
  
  // 2. Validar dados
  if (!btn) return;
  const [kind, id] = btn.dataset.action.split(":");
  if (!kind || !id) return showToast("Ação inválida");
  
  // 3. Buscar dados do storage
  const pet = getPet();
  const item = (pet[`${kind}s`] || []).find(x => x.id === id);
  
  // 4. Processar (regra de negócio complicada)
  if (kind === "med") {
    item.applications.push({...});
  } else if (kind === "vac") {
    item.doses.push(date);
  }
  
  // 5. Renderizar
  saveState();
  renderAll();
  showToast("Salvo");
};
```

**✅ CORRETO:**
```javascript
// Separar responsabilidades
const getActionFromButton = (btn) => {
  return btn?.dataset.action?.split(":") || [null, null];
};

const findItemById = (kind, id) => {
  const itemType = `${kind}s`; // medications, vaccinations, routines
  return (getPet()[itemType] || []).find(x => x.id === id);
};

const recordAction = async (kind, id) => {
  const item = findItemById(kind, id);
  if (!item) throw new Error("Item não encontrado");
  
  const date = await openDateDialog({ title: `Registrar ${kind}`, sub: "Data:", defaultISO: todayISO() });
  if (!date) return null;
  
  if (kind === "med") {
    item.applications.push({ id: generateId("a"), date, note: "" });
  } else if (kind === "vac") {
    item.doses.push(date);
  } else if (kind === "routine") {
    item.logs.push({ id: generateId("log"), date, note: "" });
  }
  
  return { item, date };
};

const handleItemAction = async (e) => {
  try {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    
    const [kind, id] = getActionFromButton(btn);
    if (!kind || !id) return showToast("Ação inválida");
    
    const result = await recordAction(kind, id);
    if (!result) return;
    
    saveState();
    renderAll();
    showToast("Registrado com sucesso");
  } catch (err) {
    showToast(`Erro: ${err.message}`);
  }
};
```

---

### 3. **KISS - Keep It Simple, Stupid**

Sempre prefira a solução mais simples que funciona.

**❌ ERRADO:**
```javascript
// Complexo demais
const getEventStatus = (event) => {
  const today = new Date();
  const dueDate = new Date(event.date);
  const timeDiff = dueDate - today;
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  
  if (daysDiff < -30) return { icon: "🗑️", label: "Muito atrasado", priority: 0 };
  if (daysDiff < 0) return { icon: "🚨", label: "Vencido", priority: 1 };
  if (daysDiff === 0) return { icon: "⏰", label: "Hoje", priority: 2 };
  if (daysDiff <= 7) return { icon: "📌", label: "Esta semana", priority: 3 };
  if (daysDiff <= 30) return { icon: "📅", label: "Este mês", priority: 4 };
  return { icon: "✅", label: "Em dia", priority: 5 };
};
```

**✅ CORRETO:**
```javascript
// Simples e direto
const computeStatus = (dueDate) => {
  if (!dueDate) return { label: "Sem data", className: "muted" };
  
  const diff = daysBetween(todayISO(), dueDate);
  
  if (diff < 0) return { label: `Vencido há ${Math.abs(diff)}d`, className: "late" };
  if (diff === 0) return { label: "Vence hoje", className: "soon" };
  if (diff <= 7) return { label: `Vence em ${diff}d`, className: "soon" };
  
  return { label: `Falta ${diff}d`, className: "ok" };
};
```

---

## 📐 Padrões de Código {#padrões}

### 1. **Factory Pattern** - Criar objetos similares

```javascript
// ❌ ERRADO - copiar/colar
const createMedication = (name, intervalDays) => ({
  id: generateId("med"),
  name,
  intervalDays,
  applications: []
});

const createVaccine = (name, intervalDays) => ({
  id: generateId("vac"),
  name,
  intervalDays,
  doses: []
});

const createRoutine = (name, everyMonths) => ({
  id: generateId("rt"),
  name,
  everyMonths,
  logs: []
});

// ✅ CORRETO - usar factory
const createItem = (kind, name, interval) => {
  const factories = {
    med: () => ({ applications: [] }),
    vac: () => ({ doses: [] }),
    routine: () => ({ logs: [] })
  };
  
  return {
    id: generateId(kind),
    name,
    [kind === "routine" ? "everyMonths" : "intervalDays"]: interval,
    ...factories[kind]?.() || {}
  };
};

// Uso
const med = createItem("med", "Bravecto", 90);
const vac = createItem("vac", "Antirrábica", 365);
const rt = createItem("routine", "Exame de fezes", 1);
```

### 2. **Strategy Pattern** - Diferentes comportamentos

```javascript
// ❌ ERRADO - múltiplos if/else
const renderItem = (item) => {
  if (item.kind === "med") {
    return `<h2>${item.name}</h2><p>Intervalo: ${item.intervalDays}</p>`;
  } else if (item.kind === "vac") {
    return `<h2>${item.name}</h2><p>Reforço: ${item.intervalDays}</p>`;
  } else if (item.kind === "routine") {
    return `<h2>${item.name}</h2><p>A cada ${item.everyMonths}</p>`;
  }
};

// ✅ CORRETO - usar strategy
const itemStrategies = {
  med: (item) => `<h2>${item.name}</h2><p>Intervalo: ${item.intervalDays}</p>`,
  vac: (item) => `<h2>${item.name}</h2><p>Reforço: ${item.intervalDays}</p>`,
  routine: (item) => `<h2>${item.name}</h2><p>A cada ${item.everyMonths}</p>`
};

const renderItem = (item) => {
  const strategy = itemStrategies[item.kind];
  return strategy ? strategy(item) : "<p>Tipo desconhecido</p>";
};
```

### 3. **Composition Pattern** - Combinar funções simples

```javascript
// ❌ ERRADO - monolítica
const renderMedicationCard = (med) => {
  const pet = getPet();
  const last = med.applications?.length 
    ? med.applications[med.applications.length - 1].date : null;
  const next = last ? nextDateFrom(last, med.intervalDays) : null;
  const status = computeStatus(next);
  
  return `
    <div class="card">
      <h2>${med.name}</h2>
      <p class="small-text">${med.doseLabel}</p>
      <div class="actions-row" style="justify-content:space-between">
        <span class="badge ${status.className}">${status.label}</span>
        <div>
          <button class="btn primary" data-med-apply="${med.id}">Registrar</button>
          <button class="btn secondary" data-ics-kind="med" data-ics-id="${med.id}">📅</button>
          <button class="btn" data-med-del="${med.id}">Excluir</button>
        </div>
      </div>
      <p class="small-text">Última: ${formatDate(last)} • Próxima: ${formatDate(next)}</p>
    </div>
  `;
};

// ✅ CORRETO - compor
const renderBadge = (status) => 
  `<span class="badge ${status.className}">${status.label}</span>`;

const renderActions = (kind, id) => 
  `<button class="btn primary" data-do-action="${kind}:${id}">Registrar</button>
   <button class="btn secondary" data-ics-kind="${kind}" data-ics-id="${id}">📅</button>
   <button class="btn" data-del-item="${kind}:${id}">Excluir</button>`;

const renderDateInfo = (last, next) =>
  `<p class="small-text">Última: ${formatDate(last)} • Próxima: ${formatDate(next)}</p>`;

const renderItemCard = (item) => {
  const next = getNextDate(item);
  const status = computeStatus(next);
  const last = getLastDate(item);
  
  return `
    <div class="card">
      <h2>${item.name}</h2>
      <p class="small-text">${item.doseLabel || item.detail || ""}</p>
      <div class="actions-row" style="justify-content:space-between">
        ${renderBadge(status)}
        <div class="actions-row">
          ${renderActions(item.kind, item.id)}
        </div>
      </div>
      ${renderDateInfo(last, next)}
    </div>
  `;
};
```

---

## ✅ Checklist de Revisão {#checklist}

Antes de fazer commit, verificar:

### Duplicação de Código
- [ ] Procurei por funções similares (renderX, computeX, handleX)?
- [ ] Extraí lógica comum em uma função genérica?
- [ ] Reutilizei helper functions em vez de copiar/colar?
- [ ] Fiz grep por "const ", "function", "async" para encontrar padrões?

### Responsabilidade Única
- [ ] Cada função tem UMA responsabilidade clara?
- [ ] Nomes descrevem o que a função faz?
- [ ] A função cabe na tela sem scroll?
- [ ] Posso entender em 30 segundos o que faz?

### Data Flow
- [ ] Os dados vêm de AppState de forma consistente?
- [ ] Validação é centralizada ou repetida?
- [ ] Salvamento é sempre feito após mudanças?
- [ ] Renderização é completa ou parcial?

### Configuração
- [ ] Settings está organizado em um lugar?
- [ ] Valores padrão são únicos (não espalhados)?
- [ ] Constantes estão no topo do arquivo?

### Testes Manuais
- [ ] Funciona em desktop?
- [ ] Funciona em mobile?
- [ ] Dados persistem após reload?
- [ ] Sem erros no console?

---

## 💡 Exemplos Práticos {#exemplos}

### Exemplo 1: Adicionar Nova Categoria de Item

Se você quer adicionar um novo tipo de item (ex: "suplementos"):

```javascript
// 1. Criar factory (já existe!)
const createSuplement = (name, intervalDays) => 
  createItem("supplement", name, intervalDays);

// 2. Renderizar (já existe!)
const renderSupplements = () => 
  renderItemList(getPet().supplements, "supplement-list");

// 3. Handlers de ação (já existe!)
// Automaticamente funciona via handleItemAction genérico

// 4. Coletar eventos (adicionar no collectUpcoming)
const collectSupplements = (pet) => {
  return (pet.supplements || []).map(s => {
    const next = getNextDate(s);
    return {
      kind: "supplement",
      id: s.id,
      title: s.name,
      detail: `Intervalo: ${s.intervalDays} dias`,
      date: next
    };
  });
};

// No collectUpcoming()
return [
  ...collectMedications(pet),
  ...collectVaccines(pet),
  ...collectRoutines(pet),
  ...collectSupplements(pet)  // Novo!
].map(e => ({ ...e, status: computeStatus(e.date) }));
```

### Exemplo 2: Adicionar Novo Campo a Todos os Itens

Se quiser adicionar "notas" a medicamentos:

```javascript
// 1. Update seedState
const seedState = () => ({
  pets: [{
    medications: [{
      id: "med_bravecto",
      name: "Bravecto",
      doseLabel: "10–20 kg",
      intervalDays: 90,
      notes: "Pode causar sonolência",  // NOVO!
      applications: [...]
    }]
  }]
});

// 2. Update form HTML
<input id="med-notes" placeholder="Notas adicionais" />

// 3. Update create logic (já atualiza automaticamente!)
document.getElementById("med-form")?.addEventListener("submit", (e) => {
  // ... existing code ...
  const notes = document.getElementById("med-notes").value.trim();
  getPet().medications.push({ 
    id: generateId("med"), 
    name, 
    doseLabel, 
    intervalDays, 
    notes,  // NOVO!
    applications: [] 
  });
});

// 4. Update render (renderItemCard já mostra tudo)
// Adicionar em renderItemCard se quiser:
const renderItemCard = (item) => {
  // ...
  const notesHTML = item.notes ? `<p class="small-text">${item.notes}</p>` : "";
  return `${existingHTML}${notesHTML}`;
};
```

---

## 🔍 Ferramentas Úteis

### Encontrar Duplicação
```bash
# Contar funções com mesmo nome
grep -o "const [a-z]*" app.js | sort | uniq -d

# Encontrar código repetido (fuzzy match)
grep -n "const last = " app.js  # Aparece várias vezes? Extrair!
```

### Validar Código
```javascript
// No console do navegador
// Verificar se há erros de sintaxe
console.log(typeof Audio); // "object"
console.log(typeof collectUpcoming); // "function"
```

---

## 📚 Referências

- [DRY Principle](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Design Patterns](https://refactoring.guru/design-patterns)
- [Clean Code](https://en.wikipedia.org/wiki/The_Pragmatic_Programmer)

---

## 🎯 Resumo

| Prática | Benefício |
|---------|-----------|
| DRY | Menos bugs, mais fácil atualizar |
| SOLID | Código mais testável e reutilizável |
| KISS | Mais fácil entender e manter |
| Factory | Criação consistente de objetos |
| Strategy | Flexibilidade sem if/else |
| Composition | Reutilização de código |

**Aplicar estas práticas torna o ScoobyCare muito mais fácil de manter e evoluir!** ✅
