/**
 * ScoobyCare - Push Server
 * Backend simples para Web Push com VAPID
 */

const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Carregar variáveis de ambiente de um .env simples (sem dependências)
const ENV_FILE = path.join(__dirname, '.env');
function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return;
  const raw = fs.readFileSync(ENV_FILE, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  });
}

function writeEnvFile(keys) {
  const subject = process.env.VAPID_SUBJECT || 'mailto:seuemailaqui@example.com';
  const content = [
    '# ScoobyCare Push Server - VAPID keys',
    `VAPID_SUBJECT=${subject}`,
    `VAPID_PUBLIC_KEY=${keys.publicKey}`,
    `VAPID_PRIVATE_KEY=${keys.privateKey}`,
    ''
  ].join('\n');
  fs.writeFileSync(ENV_FILE, content, 'utf8');
}

loadEnvFile();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Arquivo para persistir subscriptions
const SUBSCRIPTIONS_FILE = path.join(__dirname, 'subscriptions.json');

// Carregar ou criar arquivo de subscriptions
let subscriptions = [];
if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
  subscriptions = JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8'));
}

function saveSubscriptions() {
  fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2));
}

// Gerar VAPID keys (executar apenas uma vez)
function generateVapidKeys() {
  const vapidKeys = webpush.generateVAPIDKeys();
  console.log('📧 VAPID Keys geradas:');
  console.log('Public Key:', vapidKeys.publicKey);
  console.log('Private Key:', vapidKeys.privateKey);
  console.log('\n⚠️  Guarde essas chaves! Cole no arquivo .env ou no código.');
  return vapidKeys;
}

// Configurar VAPID keys
// IMPORTANTE: Substitua por suas próprias keys geradas!
let VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:seuemailaqui@example.com';

if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY === 'COLE_SUA_PUBLIC_KEY_AQUI') {
  console.log('⚠️  VAPID keys não configuradas! Gerando novas...\n');
  const keys = generateVapidKeys();
  VAPID_PUBLIC_KEY = keys.publicKey;
  VAPID_PRIVATE_KEY = keys.privateKey;
  try {
    writeEnvFile(keys);
    console.log('💾 Arquivo .env criado em server/.env');
  } catch (e) {
    console.log('⚠️  Não foi possível gravar server/.env:', e?.message || e);
  }
  console.log('\n📝 Copie as keys acima e configure no servidor!');
} else {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('✅ VAPID configurado corretamente!');
}

// AGORA configurar com as chaves (mesmo que geradas)
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Rota: Retornar public key
app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Rota: Registrar subscription
app.post('/subscribe', (req, res) => {
  const subscription = req.body;
  
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Subscription inválida' });
  }

  // Evitar duplicatas
  const exists = subscriptions.find(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    subscriptions.push(subscription);
    saveSubscriptions();
    console.log('✅ Nova subscription registrada:', subscription.endpoint.substring(0, 50) + '...');
  }

  res.status(201).json({ message: 'Subscription registrada com sucesso!' });
});

// Rota: Remover subscription
app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  
  subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
  saveSubscriptions();
  
  res.json({ message: 'Subscription removida com sucesso!' });
});

// Rota: Enviar push de teste
app.post('/send-test-push', async (req, res) => {
  const { endpoint, title, body, route } = req.body;

  const subscription = subscriptions.find(s => s.endpoint === endpoint);
  
  if (!subscription) {
    return res.status(404).json({ error: 'Subscription não encontrada' });
  }

  const payload = JSON.stringify({
    title: title || '🐶 ScoobyCare - Teste',
    body: body || 'Notificação push funcionando!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'test-notification',
    data: { route: route || 'home' }
  });

  try {
    await webpush.sendNotification(subscription, payload);
    console.log('✅ Push enviado com sucesso!');
    res.json({ message: 'Push enviado com sucesso!' });
  } catch (error) {
    console.error('❌ Erro ao enviar push:', error);
    
    // Se subscription expirou, remover
    if (error.statusCode === 410) {
      subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
      saveSubscriptions();
    }
    
    res.status(500).json({ error: 'Erro ao enviar push', details: error.message });
  }
});

// Rota: Enviar push para todos
app.post('/send-push-all', async (req, res) => {
  const { title, body, route } = req.body;

  if (subscriptions.length === 0) {
    return res.status(400).json({ error: 'Nenhuma subscription registrada' });
  }

  const payload = JSON.stringify({
    title: title || '🐶 ScoobyCare',
    body: body || 'Você tem pendências!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'scoobycare-alert',
    data: { route: route || 'home' }
  });

  const results = await Promise.allSettled(
    subscriptions.map(sub => webpush.sendNotification(sub, payload))
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`✅ Push enviado: ${succeeded} sucesso, ${failed} falhas`);

  res.json({
    message: 'Push enviado',
    succeeded,
    failed,
    total: subscriptions.length
  });
});

// Rota: Gerar VAPID keys (usar apenas uma vez)
app.get('/generate-keys', (req, res) => {
  const keys = generateVapidKeys();
  res.json(keys);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n🚀 ScoobyCare Push Server rodando em http://localhost:${PORT}`);
  console.log(`📊 Subscriptions ativas: ${subscriptions.length}`);
  console.log(`\n🔧 Endpoints disponíveis:`);
  console.log(`   GET  /vapid-public-key`);
  console.log(`   POST /subscribe`);
  console.log(`   POST /unsubscribe`);
  console.log(`   POST /send-test-push`);
  console.log(`   POST /send-push-all`);
  console.log(`   GET  /generate-keys (usar apenas uma vez)\n`);
});
