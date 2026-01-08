# 🐶 ScoobyCare

**ScoobyCare** é uma Progressive Web App (PWA) para gerenciar a saúde, rotina e lembretes do Scooby, com um sistema completo de notificações e alertas.

## 📋 Funcionalidades

- **Home** - Visão geral e informações principais
- **Peso** - Acompanhamento do peso do pet
- **Remédios** - Controle de medicamentos e horários
- **Vacinas** - Registro de vacinas e lembretes
- **Rotinas** - Gerenciamento de atividades diárias
- **Comida** - Controle de alimentação
- **Histórico** - Visualização de registros anteriores
- **🔔 Sistema de Notificações**
  - 🐕 Sons de latido personalizados (diferentes por tipo de evento)
  - 📲 Push notifications via Web Push (quando app está fechado)
  - 🏷️ Badge API (contador no ícone do app)
  - 📅 Exportação melhorada para Google Calendar (.ics)

## 🚀 Como Usar

### 1. Setup Básico (Frontend)

```bash
# Clone o repositório
git clone https://github.com/Brefire79/ScoobyCare.git
cd ScoobyCare

# Abra um servidor local na porta 8000
# Com Python:
python -m http.server 8000

# Ou com Node.js:
npx http-server -p 8000
```

Acesse: `http://localhost:8000`

### 2. Setup do Backend (Push Notifications)

O backend é necessário apenas para **Web Push Notifications** (enviar notificações quando o app está fechado).

```bash
# Entre na pasta do servidor
cd server

# Instale as dependências
npm install

# Gere as chaves VAPID (execute uma única vez)
npm run generate-keys

# Inicie o servidor
npm start
```

O servidor rodará em `http://localhost:3001`

> ⚠️ **IMPORTANTE**: O backend está configurado para `http://localhost:3001`. Se você mudar a porta, atualize `PUSH_SERVER_URL` em `app.js`.

## 🔊 Sons de Latido (META 1)

O app reproduz sons de latido diferentes dependendo do tipo de evento:

- **Latido Agudo** (🩹 Vacinas): `assets/bark-agudo.mp3`
- **Latido Grave** (💊 Remédios): `assets/bark-grave.mp3`
- **Latido Curto** (📋 Rotinas): `assets/bark-curto.mp3`

**Configuração**:
1. Vá para **Configurações**
2. Ative "🔔 Sons de latido"
3. Clique em "🔊 Testar latido" para ouvir

**Arquivo de Áudio**: Os arquivos `assets/bark-*.mp3` são atualmente placeholders. Você pode:
- Usar geradores de áudio online
- Gravar seus próprios sons
- Usar bibliotecas de áudio livre (ex: Freesound.org)

## 📲 Push Notifications (META 2)

Receba notificações mesmo quando o app está fechado!

**Requisitos**:
- Navegador moderno com suporte a Push API
- Backend rodando (`npm start` na pasta `/server/`)
- HTTPS ou localhost (para desenvolvimento)

**Configuração**:
1. Vá para **Configurações**
2. Ative "📲 Push Notifications"
3. Aprove a permissão de notificações do navegador
4. Clique em "📲 Testar push" para verificar

**Geração de Chaves VAPID**:
```bash
cd server
npm run generate-keys
```

Isso criará `.env` com as chaves públicas e privadas (não compartilhar!).

## 🏷️ Badge API (META 3)

O número de eventos pendentes aparece como um "badge" no ícone do app (quando o navegador suporta).

- Mostra automaticamente a quantidade de eventos próximos
- Funciona em: Chrome, Edge, Firefox (versões recentes)
- Fallback automático para navegadores sem suporte

## 📅 Exportar para Google Calendar (META 4)

Sincronize seus eventos com o Google Calendar:

1. Vá para **Configurações**
2. Seção **"📅 Importar Google Calendar"**
3. Siga as instruções fornecidas (diferentes para mobile/desktop)
4. Clique em **"Exportar .ics"** para baixar o arquivo
5. Importe no Google Calendar

## 📱 Instalação como PWA

O ScoobyCare pode ser instalado como um aplicativo:

- **Desktop**: Clique no ícone de instalação na barra de endereços
- **Mobile**: Use "Adicionar à tela inicial" no menu do navegador
- **Windows**: Suporte a app nativa com notificações integradas

## 🛠️ Tecnologias

- **Frontend**: HTML5, CSS3, JavaScript Vanilla
- **Backend**: Node.js, Express, web-push
- **APIs**: Service Worker, Web Push, Badging API, Web Audio API, localStorage
- **PWA**: Web App Manifest, Service Worker, Offline-first

## 💾 Armazenamento

Todos os dados são salvos localmente em `localStorage`:
- Chave de armazenamento: `scoobycare_state_v1`
- Estrutura: JSON com pets, medicamentos, vacinas, rotinas, configurações
- Sincronização: Automática após cada ação

## 🌐 Status Online/Offline

- App funciona **100% offline**
- Service Worker cacheia arquivos necessários
- Push notifications requerem conexão (óbvio!)
- Badge API atualiza conforme eventos da semana

## 🐛 Troubleshooting

### Sons não funcionam
- Certifique-se que o navegador permite áudio
- Interaja com a página antes de ativar sons (política de navegadores)
- Coloque arquivos `.mp3` reais na pasta `/assets/`

### Push Notifications não funcionam
- Verifique se o backend está rodando: `npm start` em `/server/`
- Confirme a URL do servidor em `app.js`: `PUSH_SERVER_URL = "http://localhost:3001"`
- Verifique se você aprovou a permissão de notificações
- Use HTTPS (ou localhost para desenvolvimento)

### Dados não persistem
- Limpe o cache do navegador e tente novamente
- Verifique se localStorage está habilitado
- Procure por erros no console do navegador (F12)

## 📄 Licença

Código aberto para uso pessoal.

## 👤 Autor

[@Brefire79](https://github.com/Brefire79)

---

Desenvolvido com ❤️ para o Scooby 🐕
