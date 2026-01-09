// ScoobyCare — sw.js (offline cache + push notifications)
const CACHE_NAME = "scoobycare-cache-v9";

// Assets essenciais: não podem faltar na instalação do app.
// Observação: o install NÃO deve falhar mesmo se um asset estiver faltando.
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Assets opcionais: cacheia se existir; se falhar (404), apenas loga e segue.
const OPTIONAL_ASSETS = [
  "./assets/bark-agudo.mp3",
  "./assets/bark-grave.mp3",
  "./assets/bark-curto.mp3"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const cacheOne = async (path, { optional } = { optional: false }) => {
        try {
          const request = new Request(path, { cache: "reload" });
          const response = await fetch(request);
          if (!response || !response.ok) {
            throw new Error(`HTTP ${response?.status || "(sem status)"}`);
          }
          await cache.put(request, response);
          return true;
        } catch (err) {
          const label = optional ? "optional" : "core";
          console.warn(`[SW] Cache skip (${label}): ${path}`, err);
          return false;
        }
      };

      const tasks = [
        ...CORE_ASSETS.map((p) => cacheOne(p, { optional: false })),
        ...OPTIONAL_ASSETS.map((p) => cacheOne(p, { optional: true }))
      ];

      await Promise.allSettled(tasks);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Não interceptar requests cross-origin (ex.: servidor de push em outra porta)
  try {
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
  } catch {
    // Se não conseguir parsear, deixa o browser lidar
    return;
  }

  event.respondWith(
    caches.match(req).then(async (cached) => {
      // HTML: network-first pra pegar updates
      const isHTML = req.headers.get("accept")?.includes("text/html");

      const fetchAndCache = async () => {
        const resp = await fetch(req);
        // Só cacheia respostas OK e do mesmo origin
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return resp;
      };

      if (isHTML) {
        try {
          const net = await fetchAndCache();
          return net || cached || new Response("Offline", { status: 504 });
        } catch {
          return cached || new Response("Offline", { status: 504 });
        }
      }

      // Outros: cache-first
      if (cached) return cached;
      try {
        const net = await fetchAndCache();
        return net || new Response("Offline", { status: 504 });
      } catch {
        return new Response("Offline", { status: 504 });
      }
    })
  );
});

/* ===============================
   WEB PUSH NOTIFICATIONS
================================ */

// IndexedDB simples para armazenar notificações push (lidas/não lidas)
const DB_NAME = 'scoobycare_db_v1';
const DB_STORE = 'push_inbox';

const openDb = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(DB_STORE)) {
      const store = db.createObjectStore(DB_STORE, { keyPath: 'id' });
      store.createIndex('receivedAt', 'receivedAt');
      store.createIndex('read', 'read');
    }
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const withStore = async (mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, mode);
    const store = tx.objectStore(DB_STORE);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
};

const listInbox = async (limit = 20) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const store = tx.objectStore(DB_STORE);
    const index = store.index('receivedAt');
    const items = [];
    // percorre do mais novo para o mais antigo
    const cursorReq = index.openCursor(null, 'prev');
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor || items.length >= limit) {
        resolve(items);
        return;
      }
      items.push(cursor.value);
      cursor.continue();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
};

const countUnread = async () => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const store = tx.objectStore(DB_STORE);
    const idx = store.index('read');
    const req = idx.count(false);
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
};

const setBadgeCount = async () => {
  try {
    const unread = await countUnread();
    if (typeof self.registration.setAppBadge === 'function') {
      if (unread > 0) await self.registration.setAppBadge(unread);
      else if (typeof self.registration.clearAppBadge === 'function') await self.registration.clearAppBadge();
    }
  } catch {
    // ignore
  }
};

const makeId = () => {
  try {
    if (self.crypto?.randomUUID) return self.crypto.randomUUID();
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const inferRouteFromText = (title, body) => {
  const t = `${title || ''} ${body || ''}`.toLowerCase();
  // heurística simples: texto de pendências/alertas
  if (t.includes('pend') || t.includes('venc') || t.includes('alert')) return 'alerts';
  return 'home';
};

// Receber push do servidor
self.addEventListener('push', (event) => {
  let data = {
    title: '🐶 ScoobyCare',
    body: 'Nova notificação',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'scoobycare-notification',
    data: { route: 'home' }
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  // id único para rastrear leitura
  const pushId = makeId();
  let route = data?.data?.route || 'home';
  if (!route || route === 'home') {
    route = inferRouteFromText(data?.title, data?.body);
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: { ...(data.data || {}), id: pushId, route },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Abrir App' },
      { action: 'close', title: 'Fechar' }
    ]
  };

  event.waitUntil(
    (async () => {
      // Persistir no inbox como não lida
      const inboxItem = {
        id: pushId,
        title: data.title,
        body: data.body,
        route,
        receivedAt: Date.now(),
        read: false
      };

      try {
        await withStore('readwrite', (store) => store.put(inboxItem));
      } catch {}

      await self.registration.showNotification(data.title, options);
      await setBadgeCount();

      // Se houver app aberto, avisar em tempo real
      try {
        const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientList) {
          client.postMessage({ type: 'push-received', payload: { ...inboxItem } });
        }
      } catch {}
    })()
  );
});

// Click na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Limpar badge ao abrir via notificação
  if (typeof self.registration.clearAppBadge === 'function') {
    self.registration.clearAppBadge();
  }

  const pushId = event.notification.data?.id;
  const dataUrl = event.notification.data?.url;
  const targetUrl = new URL(dataUrl || '/#alerts', self.location.origin).href;

  event.waitUntil(
    (async () => {
      // marcar como lida
      try {
        if (pushId) {
          await withStore('readwrite', (store) => {
            const getReq = store.get(pushId);
            getReq.onsuccess = () => {
              const val = getReq.result;
              if (val) {
                val.read = true;
                store.put(val);
              }
            };
          });
          await setBadgeCount();
        }
      } catch {}

      const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });

      // Se já existe alguma janela do app, focar e navegar para a rota desejada.
      const firstClient = clientList && clientList.length ? clientList[0] : null;
      if (firstClient && 'focus' in firstClient) {
        try {
          await firstClient.focus();
        } catch {}

        // Navega se suportado e se necessário
        try {
          if ('navigate' in firstClient && firstClient.url !== targetUrl) {
            await firstClient.navigate(targetUrl);
          }
        } catch {}

        return;
      }

      // Se não existe janela, abre uma nova.
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })()
  );
});

// Fechar notificação ao clicar no botão close
self.addEventListener('notificationclose', (event) => {
  event.waitUntil(
    (async () => {
      await setBadgeCount();
    })()
  );
});

// Mensagens do app (sincronizar inbox e leitura)
self.addEventListener('message', (event) => {
  const type = event?.data?.type;
  if (!type) return;

  event.waitUntil(
    (async () => {
      if (type === 'get-push-inbox') {
        const items = await listInbox(20);
        try {
          event.source?.postMessage({ type: 'push-inbox-items', items });
        } catch {}
        return;
      }

      if (type === 'mark-all-read') {
        // marca tudo como lido
        const items = await listInbox(50);
        await withStore('readwrite', (store) => {
          for (const it of items) {
            if (it && it.read === false) {
              it.read = true;
              store.put(it);
            }
          }
        });
        await setBadgeCount();
        return;
      }
    })()
  );
});
