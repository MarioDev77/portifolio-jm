'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const contactRoute = require('./contactRoute');
const { isBlocked, addStrike } = require('./ipBlocker');

const app = express();

// Necessário no Railway/atrás de proxy reverso para req.ip refletir o IP real do cliente
app.set('trust proxy', 1);

// ============================================
// Segurança de cabeçalhos HTTP
// ============================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
}));

// Esconde completamente o stack tecnológico do backend
app.disable('x-powered-by');

// ============================================
// CORS — só o domínio do portfólio pode chamar essa API
// ============================================
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Permite requisições sem Origin (ex: health checks, curl) só em rotas não sensíveis;
    // a rota de contato em si não depende disso para ser segura, pois CORS não é a única defesa.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origem não permitida pelo CORS.'));
  },
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type'],
}));

// ============================================
// Body parser com limite de tamanho (evita payloads gigantes)
// ============================================
app.use(express.json({ limit: '10kb' }));

// ============================================
// Bloqueio de IPs que já acumularam strikes (validação inválida repetida, etc.)
// ============================================
app.use(isBlocked);

// ============================================
// Rate limiting geral
// ============================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});

app.use(generalLimiter);

// Rate limit mais estrito especificamente no endpoint de contato
const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    addStrike(req);
    res.status(429).json({ error: 'Muitas tentativas de envio. Aguarde alguns minutos.' });
  },
});

// ============================================
// Rotas
// ============================================
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api', contactLimiter, contactRoute);

// 404 — resposta genérica, sem detalhes de stack/rotas internas
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// Handler de erro genérico — nunca expõe stack trace ao cliente
app.use((err, req, res, next) => {
  if (err.message === 'Origem não permitida pelo CORS.') {
    return res.status(403).json({ error: 'Origem não permitida.' });
  }
  console.error('[erro não tratado]', err);
  res.status(500).json({ error: 'Erro interno. Tente novamente mais tarde.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor do portfólio rodando na porta ${PORT}`);
});
