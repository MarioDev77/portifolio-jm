// ============================================
// Configuração
// ============================================
// Troque pela URL real do backend depois do deploy no Railway.
const API_URL = 'https://portifolio-jm-production.up.railway.app/api/contact';

// ============================================
// Ano no footer
// ============================================
document.getElementById('year').textContent = new Date().getFullYear();

// ============================================
// Menu mobile
// ============================================
const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');

menuToggle.addEventListener('click', () => {
  const isOpen = mobileMenu.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', isOpen);
  menuToggle.textContent = isOpen ? '✕' : '☰';
});

mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.textContent = '☰';
  });
});

// ============================================
// Terminal "digitando" no hero
// ============================================
const terminalEl = document.getElementById('typedTerminal');

const codeLines = [
  { text: "const dev = {", cls: '' },
  { text: "  nome: 'João Mario',", indent: true, key: 'nome' },
  { text: "  apelido: 'jm',", indent: true, key: 'apelido' },
  { text: "  local: 'Bahia, Brasil',", indent: true, key: 'local' },
  { text: "  stack: ['Node.js', 'React', 'TypeScript'],", indent: true, key: 'stack' },
  { text: "  status: 'disponível para novos projetos'", indent: true, key: 'status' },
  { text: "};", cls: '' },
  { text: "", cls: '' },
  { text: "// pronto pra construir algo novo", cls: 'comment' },
];

function renderHighlightedLine(raw) {
  // Escapa HTML primeiro
  let safe = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (safe.trim().startsWith('//')) {
    return `<span class="t-com">${safe}</span>`;
  }

  // Realça strings entre aspas simples
  safe = safe.replace(/&#39;([^&#39;]*)&#39;/g, (m) => `<span class="t-str">${m}</span>`);
  safe = safe.replace(/'([^']*)'/g, `<span class="t-str">'$1'</span>`);

  // Realça palavra-chave const
  safe = safe.replace(/^const/, '<span class="t-key">const</span>');

  // Realça chaves de propriedade (palavra antes de :)
  safe = safe.replace(/^(\s*)([a-zA-Zà-úÀ-Ú]+)(:)/, `$1<span class="t-prop">$2</span><span class="t-punc">$3</span>`);

  return safe;
}

async function typeTerminal() {
  if (!terminalEl) return;

  let finishedHtml = '';   // linhas já completas e destacadas (sintaxe colorida)
  const liveLine = document.createElement('span');

  for (const line of codeLines) {
    terminalEl.innerHTML = finishedHtml;
    terminalEl.appendChild(liveLine);

    for (let i = 0; i <= line.text.length; i++) {
      liveLine.textContent = line.text.slice(0, i);
      await sleep(line.text.length === 0 ? 0 : 14);
    }

    finishedHtml += renderHighlightedLine(line.text) + '\n';
    await sleep(120);
  }

  terminalEl.innerHTML = finishedHtml;
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  terminalEl.appendChild(cursor);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Inicia a animação quando o hero entra em viewport (ou imediatamente se já visível)
if (terminalEl) {
  typeTerminal();
}

// ============================================
// Scroll reveal (IntersectionObserver)
// ============================================
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal, .project-card').forEach(el => {
  revealObserver.observe(el);
});

// ============================================
// Formulário de contato
// ============================================
const form = document.getElementById('contact-form');
const formMsg = document.getElementById('formMsg');
const submitBtn = document.getElementById('submitBtn');

function setMsg(text, type) {
  formMsg.textContent = text;
  formMsg.className = 'form-msg' + (type ? ' ' + type : '');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

let lastSubmit = 0;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg('', '');

  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const message = form.message.value.trim();
  const honeypot = form.website.value;

  // Honeypot preenchido = bot. Falha silenciosamente como se tivesse dado certo.
  if (honeypot) {
    setMsg('Mensagem enviada com sucesso!', 'success');
    form.reset();
    return;
  }

  // Validação básica no client (defesa em profundidade — o backend valida de novo)
  if (name.length < 2 || name.length > 80) {
    setMsg('Digite um nome válido.', 'error');
    return;
  }
  if (!isValidEmail(email) || email.length > 120) {
    setMsg('Digite um e-mail válido.', 'error');
    return;
  }
  if (message.length < 10 || message.length > 2000) {
    setMsg('A mensagem precisa ter entre 10 e 2000 caracteres.', 'error');
    return;
  }

  // Throttle simples no front: evita duplo-clique / spam de cliques
  const now = Date.now();
  if (now - lastSubmit < 8000) {
    setMsg('Aguarde um instante antes de enviar de novo.', 'error');
    return;
  }
  lastSubmit = now;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando...';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, message, website: honeypot }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.status === 429) {
      setMsg('Muitas tentativas. Tente novamente em alguns minutos.', 'error');
      return;
    }

    if (!res.ok) {
      throw new Error('Falha no envio');
    }

    setMsg('Mensagem enviada com sucesso! Te respondo em breve.', 'success');
    form.reset();
  } catch (err) {
    setMsg('Não foi possível enviar agora. Tenta de novo em alguns minutos ou me chama direto no GitHub.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar mensagem';
  }
});
