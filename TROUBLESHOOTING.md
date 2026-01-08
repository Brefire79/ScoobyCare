# 🔧 Troubleshooting Interativo

## 🎵 Sons não funcionam?

### Passo 1: Verificar se está habilitado
```
✓ Vá para Configurações
✓ Procure por "🔔 Sons de latido"
✓ Está ON (verde)?
  → SIM: Vá para Passo 2
  → NÃO: Clique para ativar
```

### Passo 2: Testar o som
```
✓ Clique em "🔊 Testar latido"
✓ Você ouve um barulho?
  → SIM: Tudo bem! 🎉
  → NÃO: Vá para Passo 3
```

### Passo 3: Verificar permissão de áudio
```
Browser: Chrome/Chromium
└── Mais ferramentas → Configurações
    └── Privacidade e segurança → Permissões → Áudio
        └── Certifique-se que scoobycare está com acesso
```

### Passo 4: Verificar console
```javascript
// Abra o console (F12) e execute:
console.log(BarkSounds.enabled)        // Deve ser true
console.log(BarkSounds.unlocked)       // Deve ser true
console.log(BarkSounds.audioContext)   // Não deve ser null
```

### Passo 5: Verificar arquivos de áudio
```bash
# Os arquivos existem?
assets/bark-agudo.mp3 ✓?
assets/bark-grave.mp3 ✓?
assets/bark-curto.mp3 ✓?

# Se NÃO: Adicione os arquivos
# Se SIM: Vá para Passo 6
```

### Passo 6: Network issue
```javascript
// No console, teste carregar arquivo:
fetch('./assets/bark-agudo.mp3')
  .then(r => {
    console.log('Status:', r.status)
    return r.arrayBuffer()
  })
  .then(data => console.log('Tamanho:', data.byteLength))
  .catch(e => console.error('Erro:', e))

// Se 404: arquivo não encontrado
// Se 0 bytes: arquivo vazio/placeholder
```

### ✅ Solução
1. Coloque arquivos MP3 reais em `assets/`
2. Interaja com página (clique) antes de testar
3. Limpe cache: Ctrl+Shift+Delete
4. Recarregue página: F5

---

## 📲 Push Notifications não funcionam?

### Verificação 1: Backend rodando?
```bash
# Terminal 1: Verifique se backend está rodando
curl http://localhost:3001/vapid-public-key

# Se erro: Backend não está rodando
# Faça isso em outro terminal:
cd server
npm start

# Deve mostrar: "Servidor Push rodando em http://localhost:3001"
```

### Verificação 2: Permissão concedida?
```javascript
// No console:
Notification.permission
// Valores possíveis:
// "granted"   → ✅ Permissão dada
// "denied"    → ❌ Usuário negou
// "default"   → ❓ Ainda não perguntou
```

### Verificação 3: Subscription ativa?
```javascript
// No console:
navigator.serviceWorker.ready.then(r => {
  return r.pushManager.getSubscription()
}).then(sub => {
  if (sub) console.log('✅ Subscription ativa:', sub.endpoint)
  else console.log('❌ Sem subscription')
})
```

### Verificação 4: Testar envio
```javascript
// No console:
fetch('http://localhost:3001/send-test-push', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    endpoint: 'SEU_ENDPOINT_AQUI',
    title: 'Teste',
    body: 'Push funcionando!'
  })
})
.then(r => r.json())
.then(d => console.log('Resposta:', d))
.catch(e => console.error('Erro:', e))
```

### Verificação 5: Verificar logs do backend
```bash
# Terminal onde backend está rodando:
# Procure por linhas como:
# "POST /send-test-push 200"
# "Notificação enviada para..."
# "Erro: ..."
```

### ❌ Erros Comuns

#### "Failed to fetch"
```
Causa: Backend não está rodando
Solução: npm start em server/
```

#### "Service Worker not found"
```
Causa: sw.js não existe ou URL errada
Solução: Verifique se sw.js está na raiz
```

#### "Invalid VAPID"
```
Causa: VAPID keys não foram geradas
Solução: npm run generate-keys em server/
```

#### "Chrome: This site has been updated in the background"
```
Causa: Service Worker atualizado
Solução: Limpe dados → Configurações → Apps
```

### ✅ Solução Passo a Passo
```bash
# 1. Gerar VAPID keys
cd server
npm run generate-keys

# 2. Instalar dependências
npm install

# 3. Iniciar servidor
npm start

# 4. No outro terminal, recarregue o app
# http://localhost:8000

# 5. Vá para Configurações
# Clique em "📲 Push Notifications"
# Aprove a permissão

# 6. Clique em "📲 Testar push"
# Você deve receber uma notificação
```

---

## 🏷️ Badge não aparece?

### Verificação 1: Navegador suporta?
```javascript
// No console:
'setAppBadge' in navigator
// true  → ✅ Suportado
// false → ❌ Não suportado
```

### Verificação 2: App instalado?
```
Badge funciona melhor quando app está "instalado" como PWA
1. Clique em URL → Instalar/Adicionar à tela inicial
2. Abra a app instalada
3. Badge deve aparecer no ícone
```

### Verificação 3: Há eventos próximos?
```javascript
// No console:
collectUpcoming(getPet()).length
// Se 0: Não há eventos próximos
//       Adicione alguns para ver o badge

// Se > 0: Badge deve aparecer
```

### ✅ Solução
1. Instale app como PWA
2. Adicione alguns eventos futuros
3. Vá para Configurações → mude "Dias de alerta"
4. Recarregue e veja o badge atualizar

---

## 📅 Google Calendar não importa?

### Verificação 1: Arquivo .ics gerado?
```javascript
// No console:
exportICS()
// Deve fazer download de "scoobycare.ics"
```

### Verificação 2: Arquivo aberto com app correto?
```
Desktop:
├── Duplo clique .ics
│  └── Escolha "Google Calendar"
└── OU arraste para https://calendar.google.com

Mobile:
├── Abra com Google Calendar app
└── OU compartilhe email + importe
```

### Verificação 3: Caracteres estranhos?
```
Se eventos aparecem com "\\n" ou espaços estranhos:
Causa: Função icsEscape não está rodando
Solução: Não é problema crítico, tente reimportar
```

### ✅ Solução
1. Clique em "Exportar .ics" em Configurações
2. Salve o arquivo
3. Abra Google Calendar
4. Clique "+" → "Criar eventos de arquivo"
5. Escolha o arquivo .ics

---

## 📊 Dados desaparecem?

### Verificação 1: localStorage habilitado?
```javascript
// No console:
try {
  localStorage.setItem('test', 'test')
  localStorage.getItem('test')
  console.log('✅ localStorage OK')
} catch (e) {
  console.log('❌ localStorage disabled:', e)
}
```

### Verificação 2: Espaço suficiente?
```javascript
// No console:
AppState.schemaVersion          // Deve estar definido
Object.keys(AppState).length    // Quantas chaves tem?
JSON.stringify(AppState).length // Tamanho em bytes
```

### Verificação 3: Dados corretos no localStorage?
```javascript
// No console:
localStorage.getItem('scoobycare_state_v1')
// Deve retornar um JSON válido
```

### ✅ Solução
1. Não limpe dados/cache do navegador
2. Se limpou: Os dados voltam ao padrão
3. Tente outra aba anônima (limpa)
4. Procure erros no console (F12)

---

## 🔒 Erro HTTPS/CORS?

### Se estiver em HTTPS
```
Push notifications precisam de HTTPS
Características que funcionam:
✅ Sons de latido
✅ Badges
✅ App offline
❌ Push notifications (requer HTTPS)

Solução: Use HTTPS ou localhost
```

### CORS Error
```javascript
// Erro: "Access to XMLHttpRequest ... blocked by CORS"
// Causa: Backend e frontend em domínios diferentes
// Solução: CORS já está configurado no backend
//         Se ainda aparecer, verifique:
```

```bash
# push-server.js deve ter:
const cors = require('cors');
app.use(cors());

# E estar rodando em localhost:3001
```

---

## 🚨 Erro "Service Worker Registration Failed"

### Verificação
```javascript
// No console:
navigator.serviceWorker.ready
  .then(() => console.log('✅ SW registrado'))
  .catch(e => console.error('❌ Erro:', e))
```

### Causas Comuns
```
1. sw.js não encontrado (404)
   → Verifique se arquivo existe na raiz

2. sw.js tem erro de sintaxe
   → Execute: node -c sw.js

3. Registrado em scope errado
   → Deve ser registrado da raiz

4. Mixed HTTP/HTTPS
   → Use mesma protocolo
```

### ✅ Solução
```bash
# 1. Verifique sintaxe
node -c sw.js

# 2. Limpe registration
# Configurações → Apps e extensões → ScoobyCare → Remover
chrome://apps

# 3. Recarregue página completamente
Ctrl+Shift+R

# 4. Verifique console (F12) para erros
```

---

## 📱 Mobile específico

### Android Chrome
```
✅ Sons: Funciona
✅ Push: Funciona
✅ Badge: Funciona
✅ PWA: Funciona
❌ Restrição: Áudio pode ser silencioso inicialmente
```

### iOS Safari
```
✅ Sons: Funciona (com interação)
⚠️  Push: Limitado (iOS PWA limitado)
⚠️  Badge: Funciona em app instalada
✅ PWA: Funciona
❌ Sem background push notification
```

### Firefox
```
✅ Sons: Funciona
✅ Push: Funciona
✅ Badge: Funciona (versão recente)
✅ PWA: Funciona
```

---

## 🆘 Último Recurso

Se nada funcionar:

### 1. Limpar tudo
```bash
# Frontend
Ctrl+Shift+Delete  # Limpar cache/cookies

# localStorage
# No console:
localStorage.clear()
location.reload()

# Service Worker
chrome://serviceworkers/
# Clique em "Unregister" para scoobycare
```

### 2. Testar em modo incógnito
```
Abre uma janela incógnita (Ctrl+Shift+N)
Acessa http://localhost:8000
Se funciona lá, problema é com cache/extensões
```

### 3. Verificar extensões
```
Alguns bloqueadores de anúncio/rastreamento
podem interferir com Web Push

Tente desabilitar temporariamente
```

### 4. Procurar erros
```
Console (F12) → Aba "Console"
Network (F12) → Aba "Network"
Application (F12) → Aba "Application"
  ├── Storage
  ├── Service Workers
  ├── Manifest
```

### 5. Recriar do zero
```bash
# Se tudo falhar:
1. Remova app instalada
2. Limpe todos dados
3. Feche navegador
4. Reinicie computador (sim!)
5. Abra novo browser
6. Acesse http://localhost:8000
7. Tente novamente
```

---

## 📞 Reportar Bug

Se encontrar um bug real:

1. **Reproduza o problema** e note os passos
2. **Screenshot/vídeo** do erro
3. **Console errors** (F12 → Console)
4. **Informações**:
   - SO (Windows/Mac/Linux)
   - Navegador (Chrome 120, Firefox 121, etc)
   - Mobile ou Desktop?
5. **Abra issue** no GitHub com esses dados

---

## ✅ Verificação Final

Execute essa checklist quando tudo funcionar:

```javascript
// No console, execute:
console.log('=== VERIFICAÇÃO FINAL ===')
console.log('🔊 BarkSounds:', BarkSounds.enabled, BarkSounds.unlocked)
console.log('📲 Push:', AppState.settings?.pushNotifications?.enabled)
console.log('🏷️  Badge:', 'setAppBadge' in navigator)
console.log('💾 Storage:', localStorage.getItem('scoobycare_state_v1') ? '✅' : '❌')
console.log('🔄 ServiceWorker:', navigator.serviceWorker.controller ? '✅' : '❌')
console.log('🌍 Online:', navigator.onLine ? '✅' : '❌')
console.log('=== FIM ===')
```

Se todo feedback for positivo: ✅ Tudo OK!

---

Boa sorte! 🐕
