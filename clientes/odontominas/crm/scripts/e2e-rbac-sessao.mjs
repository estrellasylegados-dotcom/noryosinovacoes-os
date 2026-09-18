#!/usr/bin/env node
/**
 * Roteiro E2E de RBAC contra produção, com login REAL de um perfil.
 * Roda no terminal de quem tem a senha: a senha é digitada aqui (oculta), fica
 * só em memória e nunca é impressa nem gravada; o cookie também não. A saída
 * é só "verificação → status HTTP → PASSOU/FALHOU".
 *
 * Uso:
 *   node scripts/e2e-rbac-sessao.mjs --usuario rafaviriato --perfil noryos_admin --id <uuid-da-propria-conta>
 *   (--perfil: noryos_admin | noryos_suporte | dona | gerente | supervisora | atendente)
 *   (--base: padrão https://odontominas-crm-production.up.railway.app)
 *
 * Só faz leituras (GET) e escritas que DEVEM ser recusadas (403/404/400) —
 * nenhuma delas grava nada quando o resultado é o esperado. Não cria conta,
 * não muda perfil, não bloqueia ninguém, não dispara WhatsApp nem e-mail.
 * Não testa rate limit de login (5 tentativas bloqueiam o IP por 15 min).
 */
import readline from "node:readline";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const BASE = (arg("base", "https://odontominas-crm-production.up.railway.app")).replace(/\/$/, "");
const USUARIO = arg("usuario");
const PERFIL = arg("perfil");
const MEU_ID = arg("id");
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";

if (!USUARIO || !PERFIL || !MEU_ID) {
  console.log("Uso: node scripts/e2e-rbac-sessao.mjs --usuario <usuario> --perfil <perfil> --id <uuid da própria conta>");
  process.exit(1);
}

function lerSenhaOculta(pergunta) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(pergunta)) process.stdout.write(s); };
    rl.question(pergunta, (r) => { rl.close(); process.stdout.write("\n"); resolve(r); });
  });
}

// Matriz esperada por perfil (padrões atuais, docs/RBAC-VALIDACAO-E2E.md). true = permitido (2xx).
const CAN = {
  noryos_admin:   { equipe: true,  sla_ver: true,  sla_cfg: true,  horario: true,  finalizar: true,  criar: true,  perm: true,  senha: true,  editar: true,  shim: true },
  noryos_suporte: { equipe: true,  sla_ver: false, sla_cfg: false, horario: false, finalizar: false, criar: false, perm: false, senha: true,  editar: false, shim: false },
  dona:           { equipe: true,  sla_ver: true,  sla_cfg: true,  horario: true,  finalizar: true,  criar: true,  perm: true,  senha: true,  editar: true,  shim: true },
  gerente:        { equipe: true,  sla_ver: true,  sla_cfg: false, horario: false, finalizar: true,  criar: false, perm: false, senha: false, editar: false, shim: false },
  supervisora:    { equipe: false, sla_ver: false, sla_cfg: false, horario: false, finalizar: false, criar: false, perm: false, senha: false, editar: false, shim: false },
  atendente:      { equipe: false, sla_ver: true,  sla_cfg: false, horario: false, finalizar: false, criar: false, perm: false, senha: false, editar: false, shim: false },
};
const esperado = CAN[PERFIL];
if (!esperado) { console.log("Perfil desconhecido."); process.exit(1); }

const senha = await lerSenhaOculta(`Senha de ${USUARIO} (não aparece na tela): `);
let cookie = "";
let falhas = 0;
const linhas = [];

function registrar(nome, status, ok, extra = "") {
  if (!ok) falhas++;
  linhas.push(`${ok ? "PASSOU" : "FALHOU"}  ${String(status).padEnd(4)} ${nome}${extra ? "  " + extra : ""}`);
}

async function chamar(metodo, caminho, corpo, cookieUsado = cookie) {
  const r = await fetch(BASE + caminho, {
    method: metodo,
    redirect: "manual",
    headers: { "content-type": "application/json", ...(cookieUsado ? { cookie: cookieUsado } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return r;
}
const ehOk = (s) => s >= 200 && s < 300;

// 1) Login real
{
  const r = await fetch(BASE + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ usuario: USUARIO, senha }) });
  const j = await r.json().catch(() => ({}));
  registrar("login com credencial correta", r.status, r.status === 200 && j.ok === true);
  registrar(`perfil carregado = ${PERFIL}`, r.status, j.perfil === PERFIL, `(recebido: ${j.perfil ?? "?"})`);
  const sc = r.headers.get("set-cookie") ?? "";
  cookie = sc.split(";")[0];
  registrar("cookie HttpOnly + Secure + SameSite", r.status, /httponly/i.test(sc) && /secure/i.test(sc) && /samesite=/i.test(sc));
  if (!cookie) { console.log(linhas.join("\n")); console.log("\nSem sessão — abortando."); process.exit(1); }
}

// 2) Sessão inválida/adulterada é recusada
{
  const adulterado = cookie.slice(0, -3) + (cookie.endsWith("aaa") ? "bbb" : "aaa");
  const r = await chamar("GET", "/api/chat/conversas", null, adulterado);
  registrar("cookie adulterado → recusado", r.status, r.status === 401);
  const r2 = await chamar("GET", "/api/chat/conversas", null, "");
  registrar("sem cookie → recusado", r2.status, r2.status === 401);
}

// 3) Rotas com gate de permissão (o resultado depende do perfil)
const gate = async (nome, metodo, caminho, corpo, deveFuncionar) => {
  const r = await chamar(metodo, caminho, corpo);
  registrar(nome, r.status, deveFuncionar ? ehOk(r.status) : r.status === 403);
};
await gate("GET  /api/clinica/sla",     "GET", "/api/clinica/sla", null, esperado.sla_ver);
await gate("GET  /api/clinica/horario", "GET", "/api/clinica/horario", null, esperado.horario);

// escritas: usam corpo inválido/alvo inexistente de propósito → 403 se negado; 4xx de validação (nunca 2xx, nunca grava) se permitido
const escritaSegura = async (nome, metodo, caminho, corpo, permitido) => {
  const r = await chamar(metodo, caminho, corpo);
  const ok = permitido ? (r.status === 400 || r.status === 404) : r.status === 403;
  registrar(nome, r.status, ok, permitido ? "(permitido → recusado por validação, nada gravado)" : "");
};
await escritaSegura("PUT  /api/clinica/sla (corpo inválido)", "PUT", "/api/clinica/sla", { invalido: true }, esperado.sla_cfg);
await escritaSegura("POST /api/equipe (e-mail inválido)", "POST", "/api/equipe", { nome: "x", email: "invalido", perfil: "atendente" }, esperado.criar);
await escritaSegura("PATCH /api/equipe/<inexistente> (status)", "PATCH", `/api/equipe/${UUID_INEXISTENTE}`, { status: "blocked" }, esperado.editar);
await escritaSegura("PATCH /api/equipe/<inexistente>/permissoes", "PATCH", `/api/equipe/${UUID_INEXISTENTE}/permissoes`, { permissoes: null }, esperado.perm);
await escritaSegura("PATCH /api/equipe/<inexistente>/senha", "PATCH", `/api/equipe/${UUID_INEXISTENTE}/senha`, { novaSenha: "curta" }, esperado.senha);
await escritaSegura("POST /api/chat/conversas/<inexistente>/finalizar", "POST", `/api/chat/conversas/${UUID_INEXISTENTE}/finalizar`, {}, esperado.finalizar);

// 4) Proteções de auto-edição (todo perfil que chega na rota é barrado na própria conta)
{
  const r = await chamar("PATCH", `/api/equipe/${MEU_ID}`, { status: "blocked" });
  registrar("PATCH na PRÓPRIA conta (status) → nunca 2xx", r.status, r.status === 403);
  const r2 = await chamar("PATCH", `/api/equipe/${MEU_ID}/permissoes`, { permissoes: [] });
  registrar("PATCH permissões da PRÓPRIA conta → nunca 2xx", r2.status, r2.status === 403);
  const r3 = await chamar("PATCH", `/api/equipe/${MEU_ID}/senha`, { novaSenha: "outra-senha-123" });
  registrar("PATCH senha da PRÓPRIA conta pela rota de gestão → nunca 2xx", r3.status, r3.status === 403);
}

// 5) Páginas (o middleware deixa passar com sessão; o gate de perfil é da página → redirect 307 quando negado)
const pagina = async (nome, caminho, deveAbrir) => {
  const r = await chamar("GET", caminho);
  registrar(nome, r.status, deveAbrir ? r.status === 200 : r.status === 307 || r.status === 308);
};
await pagina("página /equipe", "/equipe", esperado.equipe);
await pagina("página /configuracoes/horario", "/configuracoes/horario", esperado.horario);
await pagina("página /agentes (legado/shim)", "/agentes", esperado.shim);
await pagina("página /campanhas (legado/shim)", "/campanhas", esperado.shim);

// 6) Leitura de chat: exige só sessão válida (hoje sem gate de perfil)
for (const [nome, caminho] of [["GET /api/chat/conversas", "/api/chat/conversas"], ["GET /api/chat/sla/resumo", "/api/chat/sla/resumo"], ["GET /api/notificacoes", "/api/notificacoes"]]) {
  const r = await chamar("GET", caminho);
  registrar(`${nome} (sessão válida)`, r.status, ehOk(r.status));
}

console.log(`\nE2E RBAC — perfil ${PERFIL} — ${BASE}\n`);
console.log(linhas.join("\n"));
console.log(`\n${falhas === 0 ? "TUDO COMO ESPERADO" : falhas + " VERIFICAÇÃO(ÕES) FALHOU(ARAM)"} — nenhum segredo foi impresso.`);
process.exit(falhas === 0 ? 0 : 2);
