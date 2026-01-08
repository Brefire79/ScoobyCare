# 🚀 Guia de Setup - ScoobyCare

Este guia descreve como configurar o ScoobyCare com todas as funcionalidades de notificações.

## 📋 Pré-requisitos

- Node.js 14+ instalado
- Navegador moderno (Chrome, Firefox, Edge, Safari)
- Terminal/Command Prompt

## ⚡ Quick Start (Apenas Frontend - Sem Push)

Se você **não precisa** de push notifications:

```bash
# 1. Entre na pasta do projeto
cd ScoobyCare

# 2. Inicie um servidor local
python -m http.server 8000
# OU
npx http-server -p 8000

# 3. Abra no navegador
# http://localhost:8000
```

## 🔧 Setup Completo (Com Push Notifications)

Para usar **todos** os recursos (sons + push + badges):

### Passo 1: Frontend

```bash
cd ScoobyCare

# Inicie o servidor frontend na porta 8000
python -m http.server 8000
```

### Passo 2: Backend (Em outro terminal)

```bash
cd ScoobyCare/server

# Instale dependências
npm install

# Gere as chaves VAPID (execute uma única vez)
npm run generate-keys

# Inicie o servidor na porta 3001
npm start
```

Você verá:
```
Servidor Push rodando em http://localhost:3001
```

### Passo 3: Use o App

Abra `http://localhost:8000` no navegador e:

1. **Ative os sons**
   - Vá para Configurações
   - Ative "🔔 Sons de latido"
   - Clique em "🔊 Testar latido"

2. **Ative push notifications**
   - Vá para Configurações
   - Ative "📲 Push Notifications"
   - Aprove a permissão do navegador
   - Clique em "📲 Testar push"

3. **Veja os badges**
   - Adicione alguns eventos futuros
   - O ícone do app mostrará um número com eventos pendentes

## 🎵 Adicionar Sons Personalizados

Os arquivos `assets/bark-*.mp3` são placeholders. Para adicionar seus próprios sons:

1. Obtenha 3 arquivos MP3:
   - `bark-agudo.mp3` - Som agudo/estridente
   - `bark-grave.mp3` - Som grave/profundo
   - `bark-curto.mp3` - Som curto/rápido

2. Coloque-os em `assets/` substituindo os placeholders

3. Você pode gerar sons online:
   - https://tts.google.com/ (gerar voz e editar)
   - https://www.ttsmp3.com/
   - https://freesound.org/ (buscar "dog bark")

## 🔑 Chaves VAPID

As chaves VAPID são geradas automaticamente com:

```bash
cd server
npm run generate-keys
```

Isso cria um arquivo `.env` com:
- `VAPID_PUBLIC_KEY` - Compartilhável, usada no frontend
- `VAPID_PRIVATE_KEY` - SECRETO, nunca compartilhar!

> ⚠️ **Importante**: Não compartilhe o `.env`! Adicione-o ao `.gitignore`.

## 🚪 Endpoints do Backend

O servidor fornece esses endpoints:

- `GET /vapid-public-key` - Retorna a chave pública VAPID
- `POST /subscribe` - Registra um novo subscriber
- `POST /unsubscribe` - Remove um subscriber
- `POST /send-test-push` - Envia uma notificação de teste
- `POST /send-push-all` - Envia notificação para todos (admin)

## 📱 Testando em Mobile

1. **Android (Chrome)**
   - Acesse o app em `http://localhost:8000` (se na mesma rede)
   - Ou use ngrok para expor localmente

2. **iOS (PWA limitado)**
   - Funciona bem, mas push é limitado
   - Adicione à tela inicial para melhor experiência

## 🐛 Problemas Comuns

### "Sound not unlocked"
**Causa**: Você precisa interagir com a página antes de reproduzir áudio.
**Solução**: Clique em qualquer elemento, depois ative os sons.

### Push notifications não funcionam
**Causas possíveis**:
- Backend não está rodando: `npm start` em `/server/`
- Permissão não foi concedida
- Usando HTTPS mas chaves VAPID incorretas

**Solução**:
1. Verifique o console (F12) para erros
2. Confirme que backend está rodando em `localhost:3001`
3. Limpe dados e permissões: `chrome://settings/content/notifications`

### App não salva dados
**Causa**: `localStorage` desabilitado ou quota excedida.
**Solução**:
- Habilite localStorage nas configurações do navegador
- Limpe dados antigos em Configurações

## 🔄 Fluxo de Notificações

```
┌─────────────────────────────────────┐
│         APP ABERTO                  │
├─────────────────────────────────────┤
│ ✅ Sons de latido (BarkSounds)      │
│ ✅ Badge no ícone (AppBadge)        │
│ ❌ Push notifications (envia app     │
│    fecha = servidor detecta e       │
│    envia push)                      │
└─────────────────────────────────────┘
              ↓
        ┌─────────────────────────────────────┐
        │        APP FECHADO                  │
        ├─────────────────────────────────────┤
        │ ❌ Sons de latido                   │
        │ ❌ Badge                            │
        │ ✅ Push notifications               │
        │    (Service Worker recebe)          │
        └─────────────────────────────────────┘
```

## 📊 Estrutura do Projeto

```
ScoobyCare/
├── app.js                  # Lógica principal (com BarkSounds, PushNotifications)
├── index.html              # UI (com Settings para notificações)
├── styles.css              # Estilos (inclui details/summary)
├── sw.js                   # Service Worker (push handlers)
├── manifest.json           # PWA manifest
│
├── assets/                 # Arquivos de áudio
│   ├── bark-agudo.mp3
│   ├── bark-grave.mp3
│   └── bark-curto.mp3
│
├── server/                 # Backend Node.js
│   ├── push-server.js      # Express + web-push
│   ├── package.json
│   ├── README.md
│   └── .env                # Gerado com chaves VAPID
│
├── icons/                  # Ícones PWA
│   ├── icon-192.png
│   └── icon-512.png
│
└── README.md               # Este arquivo
```

## 🎯 Checklist de Setup

- [ ] Frontend rodando em `http://localhost:8000`
- [ ] Backend rodando em `http://localhost:3001`
- [ ] Sons testados (botão "🔊 Testar latido")
- [ ] Push notifications ativadas
- [ ] Push de teste recebido
- [ ] Badge aparece com eventos pendentes
- [ ] Dados persistem após reload

## 📚 Referências

- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Badging API](https://developer.mozilla.org/en-US/docs/Web/API/Badging_API)
- [web-push (npm)](https://github.com/web-push-libs/web-push)

## 🆘 Suporte

Se encontrar problemas:

1. Verifique o console (F12) para erros
2. Leia o troubleshooting no [README.md](README.md)
3. Procure por issues no repositório

---

Boa sorte com o ScoobyCare! 🐕
