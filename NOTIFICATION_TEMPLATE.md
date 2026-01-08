# Template reutilizável — Notificações (Web/PWA)

Este arquivo é um “guia de bolso” para você reaplicar notificações em outro app web/PWA.

## 1) Tipos de notificação (conceitos)

### A) Notificação local (app aberto)
- Usa **Notification API** diretamente na página.
- Requer permissão do usuário, mas não precisa de Push.
- Não aparece com o app fechado.

### B) Push Notification (app fechado ou aberto)
- Precisa de **Service Worker** + **Push API**.
- Precisa de um **servidor** que envie via **Web Push Protocol** usando **VAPID**.

### C) Badge (número no ícone do app)
- Usa **Badging API**.
- Importante: decida o significado do número:
  - “pendências” (itens vencidos, etc.), ou
  - “notificações não lidas” (contador de mensagens/push).
- Se misturar os dois conceitos, o número pode “voltar” ao abrir o app.

---

## 2) Pré-requisitos e regras (muito importante)

1. Push normalmente exige **HTTPS** (exceção: `http://localhost`).
2. O usuário precisa **conceder permissão** (não existe Push sem isso).
3. O Service Worker não pode quebrar requisições cross-origin:
   - Se você usa um servidor em outra porta/domínio (ex.: `http://localhost:3001`), evite interceptar esses requests no `fetch` do SW.
4. Para Push, a VAPID public key precisa estar em formato base64url e decodificar para **65 bytes**.

---

## 3) Fluxo completo (checklist)

### Cliente (página)
1. Registrar Service Worker (`navigator.serviceWorker.register`).
2. Pedir permissão (`Notification.requestPermission`).
3. Buscar VAPID public key no servidor (`GET /vapid-public-key`).
4. Criar subscription (`pushManager.subscribe({ applicationServerKey })`).
5. Enviar subscription para o servidor (`POST /subscribe`).
6. (Opcional) Botão de teste (`POST /send-test-push`).

### Service Worker
1. Escutar `push` e mostrar notificação (`registration.showNotification`).
2. Escutar `notificationclick` para abrir/focar o app.
3. (Opcional) Controlar badge no SW (`registration.setAppBadge/clearAppBadge`).

### Servidor
1. Gerar chaves VAPID uma vez.
2. Expor `GET /vapid-public-key`.
3. Receber e persistir subscriptions (`POST /subscribe`).
4. Enviar push via `web-push`.

---

## 4) Código mínimo — Cliente (JS)

> Ajuste `PUSH_SERVER_URL` e o caminho do seu service worker.

```js
const PUSH_SERVER_URL = 'http://localhost:3001';

async function registerSW() {
  if (!('serviceWorker' in navigator)) throw new Error('Sem Service Worker');
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) throw new Error('Notification API indisponível');
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function getVapidPublicKey() {
  const res = await fetch(`${PUSH_SERVER_URL}/vapid-public-key`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Falha ao buscar VAPID public key: HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.publicKey) throw new Error('Servidor não retornou publicKey');
  return data.publicKey;
}

async function subscribeToPush() {
  const swReady = await registerSW();

  const granted = await requestNotificationPermission();
  if (!granted) throw new Error('Permissão negada');

  const vapidPublicKey = await getVapidPublicKey();
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

  const subscription = await swReady.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  const res = await fetch(`${PUSH_SERVER_URL}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });
  if (!res.ok) throw new Error(`Falha ao registrar subscription: HTTP ${res.status}`);

  return subscription;
}

async function unsubscribeFromPush() {
  const swReady = await registerSW();
  const sub = await swReady.pushManager.getSubscription();
  if (!sub) return;

  await sub.unsubscribe();

  // opcional: avisar servidor para limpar
  await fetch(`${PUSH_SERVER_URL}/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
}
```

---

## 5) Código mínimo — Service Worker (sw.js)

Pontos-chave:
- Não interceptar requests cross-origin no `fetch`.
- Sempre retornar uma `Response` válida em `event.respondWith`.

```js
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // NÃO interceptar requests fora do origin do app
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Se você usar cache, garanta que SEMPRE retorna Response
  event.respondWith(fetch(req).catch(() => new Response('Offline', { status: 504 })));
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Meu App', body: 'Nova notificação', data: { route: 'home' } };
  if (event.data) {
    try { payload = { ...payload, ...event.data.json() }; }
    catch { payload.body = event.data.text(); }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: payload.data,
    }).then(() => {
      // Badge opcional
      if (typeof self.registration.setAppBadge === 'function') {
        self.registration.setAppBadge(1);
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (typeof self.registration.clearAppBadge === 'function') {
    self.registration.clearAppBadge();
  }

  const route = event.notification.data?.route || 'home';
  const urlToOpen = new URL(`/#${route}`, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) return client.focus();
      }
      return clients.openWindow ? clients.openWindow(urlToOpen) : undefined;
    })
  );
});

self.addEventListener('notificationclose', () => {
  if (typeof self.registration.clearAppBadge === 'function') {
    self.registration.clearAppBadge();
  }
});
```

---

## 6) Código mínimo — Servidor (Node + Express + web-push)

Instalação:
- `npm i express web-push cors`

```js
const express = require('express');
const cors = require('cors');
const webpush = require('web-push');

const app = express();
app.use(cors());
app.use(express.json());

// Gere uma vez e guarde:
// const keys = webpush.generateVAPIDKeys(); console.log(keys);

const VAPID_SUBJECT = 'mailto:voce@exemplo.com';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const subscriptions = []; // em produção: persistir

app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint) return res.status(400).json({ error: 'Subscription inválida' });
  if (!subscriptions.find(s => s.endpoint === sub.endpoint)) subscriptions.push(sub);
  res.status(201).json({ ok: true });
});

app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body || {};
  const idx = subscriptions.findIndex(s => s.endpoint === endpoint);
  if (idx >= 0) subscriptions.splice(idx, 1);
  res.json({ ok: true });
});

app.post('/send-test-push', async (req, res) => {
  const { endpoint } = req.body;
  const sub = subscriptions.find(s => s.endpoint === endpoint);
  if (!sub) return res.status(404).json({ error: 'Subscription não encontrada' });

  const payload = JSON.stringify({
    title: 'Teste',
    body: 'Push funcionando',
    data: { route: 'home' },
  });

  try {
    await webpush.sendNotification(sub, payload);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3001, () => console.log('Push server em http://localhost:3001'));
```

---

## 7) Erros comuns e diagnóstico rápido

- `Failed to convert value to 'Response'`:
  - Seu Service Worker está fazendo `event.respondWith(...)` e, em algum caminho, retorna `undefined`.
  - Corrija para sempre retornar `Response` ou não interceptar aquele request.

- `net::ERR_FAILED` ao buscar `/vapid-public-key`:
  - Servidor não está rodando, CORS bloqueando, ou SW interceptando cross-origin.

- Push não chega:
  - Permissão negada, subscription não enviada ao servidor, ou servidor não consegue enviar (VAPID errada / subscription expirada / bloqueio do navegador).

---

## 8) Mini checklist para reaplicar em outro app

- [ ] App em HTTPS (ou localhost)
- [ ] Service Worker registrado
- [ ] `Notification.requestPermission()` com UI clara
- [ ] Endpoint `GET /vapid-public-key`
- [ ] `pushManager.subscribe()` com `applicationServerKey`
- [ ] `POST /subscribe` persistindo subscription
- [ ] SW: `push` -> `showNotification`
- [ ] SW: `notificationclick` -> abrir/focar app
- [ ] Badge: decidir conceito (pendências vs não lidas) e limpar/recalcular corretamente
