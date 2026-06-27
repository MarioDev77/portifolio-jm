'use strict';

/**
 * Bloqueio progressivo de IP em memória.
 *
 * Mesmo padrão usado no chatbot da Crisoverde e no catálogo Evidências Modas:
 * cada tentativa suspeita (ex: falha de validação repetida, rate limit excedido)
 * soma um "strike". A cada novo strike, o tempo de bloqueio dobra.
 *
 * Importante: isso é em memória, então reinicia se o processo reiniciar.
 * Para esse caso de uso (formulário de contato de portfólio, tráfego baixo),
 * isso é suficiente e evita a complexidade de um Redis externo.
 */

const STRIKES = new Map(); // ip -> { count, blockedUntil }
const BASE_BLOCK_MS = 60 * 1000; // 1 minuto
const MAX_BLOCK_MS = 24 * 60 * 60 * 1000; // 24 horas
const STRIKE_RESET_MS = 60 * 60 * 1000; // strikes "esfriam" depois de 1h sem novas ofensas

function getClientIp(req) {
  // Confia no header X-Forwarded-For só se vier de um proxy confiável (Railway define isso).
  // app.set('trust proxy', 1) no server.js garante que req.ip já vem correto.
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function isBlocked(req, res, next) {
  const ip = getClientIp(req);
  const record = STRIKES.get(ip);

  if (record && record.blockedUntil > Date.now()) {
    const retryAfterSec = Math.ceil((record.blockedUntil - Date.now()) / 1000);
    res.set('Retry-After', String(retryAfterSec));
    return res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' });
  }

  next();
}

function addStrike(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = STRIKES.get(ip);

  if (!record || now - record.lastStrike > STRIKE_RESET_MS) {
    STRIKES.set(ip, { count: 1, lastStrike: now, blockedUntil: 0 });
    return;
  }

  const count = record.count + 1;
  const blockMs = Math.min(BASE_BLOCK_MS * Math.pow(2, count - 1), MAX_BLOCK_MS);

  STRIKES.set(ip, {
    count,
    lastStrike: now,
    blockedUntil: now + blockMs,
  });
}

// Limpeza periódica pra não deixar o Map crescer indefinidamente
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of STRIKES.entries()) {
    if (record.blockedUntil < now && now - record.lastStrike > STRIKE_RESET_MS) {
      STRIKES.delete(ip);
    }
  }
}, 30 * 60 * 1000).unref();

module.exports = { isBlocked, addStrike, getClientIp };
