'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const { addStrike } = require('./ipBlocker');

const router = express.Router();

/**
 * Sanitização extra além do express-validator:
 * remove qualquer coisa que pareça tentativa de injetar HTML/script,
 * já que esse texto vai ser inserido no corpo de um e-mail.
 */
function stripDangerousChars(str) {
  return str
    .replace(/</g, '‹')
    .replace(/>/g, '›')
    .trim();
}

const contactValidators = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Nome deve ter entre 2 e 80 caracteres.')
    .matches(/^[a-zA-ZÀ-ÿ\s'.-]+$/)
    .withMessage('Nome contém caracteres inválidos.'),

  body('email')
    .trim()
    .isEmail()
    .withMessage('E-mail inválido.')
    .isLength({ max: 120 })
    .withMessage('E-mail muito longo.')
    .normalizeEmail(),

  body('message')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Mensagem deve ter entre 10 e 2000 caracteres.'),

  // Honeypot: campo que humanos não veem nem preenchem.
  // Se vier preenchido, é quase certeza que é bot.
  body('website').optional({ checkFalsy: true }).isLength({ max: 0 }),
];

router.post('/contact', contactValidators, async (req, res) => {
  const errors = validationResult(req);

  // Honeypot preenchido → trata como bot, mas responde como se tivesse dado certo
  // (não dar feedback de "te detectei" pra quem está testando o formulário)
  if (req.body.website) {
    addStrike(req);
    return res.status(200).json({ success: true });
  }

  if (!errors.isEmpty()) {
    addStrike(req);
    return res.status(400).json({
      error: 'Dados inválidos.',
      details: errors.array().map(e => e.msg),
    });
  }

  const name = stripDangerousChars(req.body.name);
  const email = req.body.email.trim();
  const message = stripDangerousChars(req.body.message);

  try {
    await sendContactEmail({ name, email, message });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[contact] erro ao enviar e-mail:', err.message);
    return res.status(502).json({ error: 'Não foi possível enviar a mensagem agora. Tente novamente em breve.' });
  }
});

async function sendContactEmail({ name, email, message }) {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL || 'Portfólio <onboarding@resend.dev>';

  if (!apiKey || !toEmail) {
    throw new Error('RESEND_API_KEY ou CONTACT_TO_EMAIL não configurados.');
  }

  const { Resend } = require('resend');
  const resend = new Resend(apiKey);

  const escapedMessage = escapeHtml(message).replace(/\n/g, '<br>');

  await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    reply_to: email,
    subject: `Novo contato no portfólio: ${name}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <p><strong>Nome:</strong> ${escapeHtml(name)}</p>
        <p><strong>E-mail:</strong> ${escapeHtml(email)}</p>
        <p><strong>Mensagem:</strong></p>
        <p>${escapedMessage}</p>
      </div>
    `,
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = router;
