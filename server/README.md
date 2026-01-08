# ScoobyCare Push Server

## Configuração Inicial

### 1. Instalar dependências
```bash
cd server
npm install
```

### 2. Gerar VAPID Keys (apenas uma vez)
```bash
npm run generate-keys
```

Copie as keys geradas e cole no arquivo `push-server.js` nas constantes:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

### 3. Iniciar o servidor
```bash
npm start
```

O servidor rodará em `http://localhost:3001`

## Endpoints

- `GET /vapid-public-key` - Retorna a public key para o frontend
- `POST /subscribe` - Registra uma subscription
- `POST /unsubscribe` - Remove uma subscription
- `POST /send-test-push` - Envia push para uma subscription específica
- `POST /send-push-all` - Envia push para todas as subscriptions
- `GET /generate-keys` - Gera novas VAPID keys

## Testando

1. Abra o app em `http://localhost:8000`
2. Vá em Settings > Notificações
3. Ative "Push Notifications"
4. Clique em "Enviar push de teste"
5. Você deve receber uma notificação do navegador
