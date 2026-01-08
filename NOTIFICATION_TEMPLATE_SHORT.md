# Notificações (Web/PWA) — Template ultra curto

## Fluxo (fim a fim)
1. **Registrar Service Worker** (SW)
2. **Pedir permissão**: `Notification.requestPermission()`
3. **Buscar VAPID public key**: `GET /vapid-public-key`
4. **Criar subscription**: `pushManager.subscribe({ applicationServerKey })`
5. **Enviar subscription ao servidor**: `POST /subscribe`
6. **Servidor envia push** via Web Push Protocol (VAPID)
7. **SW recebe `push`** e chama `showNotification()`
8. (Opcional) **Badge**: set/clear ao receber/clicar

---

## Pré-requisitos
- Push exige **HTTPS** (exceto `http://localhost`).
- Sem SW não existe Push.
- **Nunca** faça seu SW quebrar requests cross-origin (ex.: outra porta/domínio).

---

## Endpoints mínimos (servidor)
- `GET  /vapid-public-key` → `{ publicKey }`
- `POST /subscribe` → guarda subscription
- `POST /unsubscribe` → remove subscription
- (opcional) `POST /send-test-push`

---

## Trechos mínimos

### Cliente (inscrever)
```js
const PUSH_SERVER_URL = 'http://localhost:3001';

await navigator.serviceWorker.register('/sw.js');
const reg = await navigator.serviceWorker.ready;

const perm = await Notification.requestPermission();
if (perm !== 'granted') throw new Error('Permissão negada');

const { publicKey } = await (await fetch(`${PUSH_SERVER_URL}/vapid-public-key`)).json();
const applicationServerKey = urlBase64ToUint8Array(publicKey);

const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
await fetch(`${PUSH_SERVER_URL}/subscribe`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub)
});
```

### SW (receber e abrir)
```js
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // não intercepta cross-origin
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'App', body: 'Nova notificação' };
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, data: data.data }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/')); // ou /#rota
});
```

---

## Erros clássicos (e causa)
- **`Failed to convert value to 'Response'`**: seu SW fez `event.respondWith(...)` e em algum caminho retornou `undefined`.
- **`net::ERR_FAILED` em `/vapid-public-key`**: servidor off, CORS, ou SW interceptando cross-origin.

---

## Badge (decisão de design)
- Defina o significado do número:
  - **pendências** (itens vencidos) OU
  - **notificações não lidas**.
- Se você recalcular por “pendências” ao abrir o app, o badge pode reaparecer mesmo após clicar a notificação.
