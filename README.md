# Portfólio — João Mario (jm)

Site de portfólio pessoal com formulário de contato funcional.

## Estrutura

```
portfolio/
├── frontend/          → deploy no Vercel (site estático)
│   ├── index.html
│   ├── css/style.css
│   ├── js/main.js
│   └── images/
└── backend/           → deploy no Railway (API do formulário de contato)
    ├── src/
    │   ├── server.js
    │   ├── contactRoute.js
    │   └── ipBlocker.js
    ├── package.json
    └── .env.example
```

## Como colocar no ar

### 1. Backend (Railway)

1. Crie um novo projeto no Railway e conecte este repositório (ou a pasta `backend/`).
2. Configure o **Start Command**: `npm start` (ou deixe o Railway detectar pelo `package.json`).
3. Vá em **Variables** e configure, copiando os nomes do `.env.example`:
   - `CORS_ORIGIN` → vai ser a URL do seu site no Vercel (ex: `https://jm-portfolio.vercel.app`). **Sem barra no final.**
   - `RESEND_API_KEY` → crie uma conta gratuita em [resend.com](https://resend.com) e gere uma API key.
   - `CONTACT_TO_EMAIL` → o e-mail que vai **receber** as mensagens (o seu).
   - `CONTACT_FROM_EMAIL` → pode deixar o padrão do `.env.example` se ainda não tiver domínio verificado no Resend.
4. Deploy. Anote a URL pública que o Railway gerar (ex: `https://seu-projeto.up.railway.app`).

### 2. Frontend (Vercel)

1. Antes de subir, edite `frontend/js/main.js` e troque a linha:
   ```js
   const API_URL = 'https://SEU-BACKEND.up.railway.app/api/contact';
   ```
   pela URL real do backend que você anotou no passo anterior, terminando em `/api/contact`.
2. Importe a pasta `frontend/` como um novo projeto no Vercel (Framework Preset: **Other / Static**).
3. Deploy.
4. Volte no Railway e confirme que `CORS_ORIGIN` está exatamente igual à URL final que o Vercel te deu.

### 3. Coloca o link na bio do Instagram

Depois do deploy, o link do Vercel (ex: `https://jm-portfolio.vercel.app`) é o que vai na bio.

## Segurança implementada no backend

- **Helmet** — cabeçalhos HTTP de segurança (CSP travado, sem `X-Powered-By`).
- **CORS travado** — só a URL do seu frontend pode chamar a API.
- **Rate limiting em duas camadas** — limite geral por IP + limite mais estrito só na rota de contato (5 envios / 10 min).
- **Bloqueio progressivo de IP** — quem abusa (validação inválida repetida, rate limit excedido) acumula "strikes"; o tempo de bloqueio dobra a cada novo strike, até 24h.
- **Honeypot** — campo invisível no formulário; bots que preenchem tudo automaticamente caem nessa armadilha e são silenciosamente ignorados.
- **Validação rigorosa (express-validator)** — nome, e-mail e mensagem validados em formato e tamanho antes de qualquer processamento.
- **Sanitização contra injeção de HTML** — qualquer `<` ou `>` no nome/mensagem é neutralizado antes de entrar no corpo do e-mail.
- **Limite de payload** — requisições maiores que 10kb são rejeitadas antes de processar.
- **Erros opacos** — nenhuma resposta de erro expõe stack trace, nomes de rotas internas ou detalhes de infraestrutura.

## Rodando localmente

```bash
# Backend
cd backend
cp .env.example .env   # edite com seus dados
npm install
npm run dev             # http://localhost:3000

# Frontend — qualquer servidor estático, ex:
cd frontend
npx serve .
```
