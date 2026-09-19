#!/usr/bin/env node
/**
 * Roteiro E2E da Central de Alertas contra produção, com login REAL de um perfil.
 * Mesmo modelo de e2e-rbac-sessao.mjs: a senha é digitada aqui (oculta), fica só
 * em memória e nunca é impressa nem gravada; o cookie também não. A saída é só
 * "verificação → status HTTP → PASSOU/FALHOU".
 *
 * Uso (um perfil por vez):
 *   node scripts/e2e-alertas-sessao.mjs --usuario <usuario> --perfil <perfil>
 *        [--alerta <uuid de alerta [TESTE]>] [--tecnico <uuid de alerta técnico [TESTE]>]
 *   (--perfil: noryos_admin | noryos_suporte | dona | gerente | supervisora | atendente)
 *
 * SEM --alerta/--tecnico só faz leituras e escritas que DEVEM ser recusadas
 * (nada grava). COM --alerta, assume e resolve esse alerta (mutação) — passe só
 * o id de um alerta [TESTE]. Nunca mexe em paciente, canal ou configuração.
 */
import readline from "node:readline";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const BASE = arg("base", "https://odontominas-crm-production.up.railway.app").replace(/\/$/, "");
const USUARIO = arg("usuario");
const PERFIL = arg("perfil");
const ALERTA = arg("alerta");
const TECNICO = arg("tecnico");
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";

// Matriz esperada (padrões do catálogo). true = permitido.
const CAN = {
  noryos_admin:   { config: true,  ignorar: true,  tecnicos: true },
  noryos_suporte: { config: false, ignorar: false, tecnicos: true },
  dona:           { config: true,  ignorar: true,  tecnicos: false },
  gerente:        { config: false, ignorar: true,  tecnicos: false },
  supervisora:    { config: false, ignorar: false, tecnicos: false },
  atendente:      { config: false, ignorar: false, tecnicos: false },
};
const esperado = CAN[PERFIL];
if (!USUARIO || !esperado) {
  console.log("Uso: node scripts/e2e-alertas-sessao.mjs --usuario <usuario> --perfil <noryos_admin|noryos_suporte|dona|gerente|supervisora|atendente> [--alerta <id>] [--tecnico <id>]");
  process.exit(1);
}

function lerSenhaOculta(pergunta) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(pergunta)) process.stdout.write(s); };
    rl.question(pergunta, (r) => { rl.close(); process.stdout.write("\n"); resolve(r); });
  });
}

const senha = await lerSenhaOculta(`Senha de ${USUARIO} (não aparece na tela): `);
let cookie = "";
let falhas = 0;
const linhas = [];
const registrar = (nome, status, ok, extra = "") => {
  if (!ok) falhas++;
  linhas.push(`${ok ? "PASSOU" : "FALHOU"}  ${String(status).padEnd(4)} ${nome}${extra ? "  " + extra : ""}`);
};
async function chamar(metodo, caminho, corpo) {
  const r = await fetch(BASE + caminho, { method: metodo, redirect: "manual", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* corpo não-JSON */ }
  return { status: r.status, json, texto };
}

// 1) Login
{
  const r = await fetch(BASE + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ usuario: USUARIO, senha }) });
  const j = await r.json().catch(() => ({}));
  registrar("login", r.status, r.status === 200 && j.ok === true);
  registrar(`perfil = ${PERFIL}`, r.status, j.perfil === PERFIL, `(recebido: ${j.perfil ?? "?"})`);
  cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  if (!cookie) { console.log(linhas.join("\n")); console.log("\nSem sessão — abortando."); process.exit(1); }
}

// 2) Sino / contador
const resumo = await chamar("GET", "/api/alertas/resumo");
registrar("GET /api/alertas/resumo (sino/contador)", resumo.status, resumo.status === 200 && typeof resumo.json?.relevantes === "number" && Array.isArray(resumo.json?.ultimos),
  resumo.json ? `(críticos ${resumo.json.criticos}, atenção ${resumo.json.atencao}, informativos ${resumo.json.informativos}, resolvidos hoje ${resumo.json.resolvidosHoje})` : "");
if (resumo.json) registrar("contador do sino = críticos + atenção (informativo/resolvido não contam)", resumo.status, resumo.json.relevantes === resumo.json.criticos + resumo.json.atencao);

// 3) Central: lista, ordem, campos expostos
const lista = await chamar("GET", "/api/alertas");
registrar("GET /api/alertas (Central)", lista.status, lista.status === 200 && Array.isArray(lista.json?.alertas), lista.json ? `(${lista.json.total} abertos visíveis)` : "");
const itens = lista.json?.alertas ?? [];
const ordemOk = itens.every((a, i) => i === 0 || ["informativo", "atencao", "critico"].indexOf(itens[i - 1].severidade) >= ["informativo", "atencao", "critico"].indexOf(a.severidade));
registrar("ordenação: críticos primeiro", lista.status, ordemOk);
registrar("nenhum campo interno exposto (dados, chave, stack)", lista.status, itens.every((a) => !("dados" in a) && !("chaveAtiva" in a) && !("chaveDeduplicacao" in a)));
if (!esperado.tecnicos) {
  const vaza = /worker|heartbeat|stack ?trace|http_\d{3}|running|queued|waiting_/i.test(lista.texto);
  registrar("perfil de clínica: nenhum termo técnico interno na resposta", lista.status, !vaza && itens.every((a) => a.natureza !== "tecnico"));
  registrar("perfil de clínica: zero alertas de natureza técnica", lista.status, itens.every((a) => a.natureza !== "tecnico"));
} else {
  registrar("perfil de plataforma: alertas técnicos permitidos (informativo: quantidade)", lista.status, true, `(${itens.filter((a) => a.natureza === "tecnico").length} técnicos)`);
}

// 4) Filtros
for (const sev of ["critico", "atencao", "informativo"]) {
  const r = await chamar("GET", `/api/alertas?severidade=${sev}`);
  registrar(`filtro severidade=${sev}`, r.status, r.status === 200 && (r.json?.alertas ?? []).every((a) => a.severidade === sev), `(${r.json?.total ?? "?"})`);
}
{
  const r = await chamar("GET", "/api/alertas?categoria=CANAL");
  registrar("filtro categoria=CANAL", r.status, r.status === 200 && (r.json?.alertas ?? []).every((a) => a.categoria === "CANAL"));
  const s = await chamar("GET", "/api/alertas?responsavel=sem");
  registrar("filtro responsável=sem (equipe)", s.status, s.status === 200 && (s.json?.alertas ?? []).every((a) => a.responsavelId === null));
  const h = await chamar("GET", "/api/alertas?situacao=resolvidos");
  registrar("aba Resolvidos", h.status, h.status === 200 && (h.json?.alertas ?? []).every((a) => a.status === "resolvido" || a.status === "ignorado"), `(${h.json?.total ?? "?"})`);
  const b = await chamar("GET", "/api/alertas?busca=" + encodeURIComponent("[TESTE]"));
  registrar("busca por texto/paciente/contexto", b.status, b.status === 200, `(${b.json?.total ?? "?"} com "[TESTE]")`);
}

// 5) Detalhe e links de contexto
if (itens[0]) {
  const d = await chamar("GET", `/api/alertas/${itens[0].id}`);
  registrar("abrir alerta (detalhe + histórico)", d.status, d.status === 200 && Array.isArray(d.json?.historico) && d.json.historico.length >= 1);
  const comLink = itens.filter((a) => a.destino?.href);
  registrar("alertas com link direto para o contexto", lista.status, comLink.length === itens.length, comLink[0] ? `(ex.: ${comLink[0].destino.href})` : "");
}
{
  const r = await chamar("GET", `/api/alertas/${UUID_INEXISTENTE}`);
  registrar("alerta inexistente/fora do escopo → 404 (não vaza existência)", r.status, r.status === 404);
}

// 6) RBAC das rotas
{
  const c = await chamar("GET", "/api/alertas/config");
  registrar("GET /api/alertas/config", c.status, esperado.config ? c.status === 200 : c.status === 403);
  const put = await chamar("PUT", "/api/alertas/config", { semResponsavelMinutos: 0 });
  registrar("PUT config com valor inválido (nunca grava)", put.status, esperado.config ? put.status === 400 : put.status === 403);
  for (const [acao, permitido] of [["assumir", true], ["resolver", true], ["ignorar", esperado.ignorar]]) {
    const r = await chamar("POST", `/api/alertas/${UUID_INEXISTENTE}/${acao}`, acao === "ignorar" ? { motivo: null } : undefined);
    registrar(`POST /api/alertas/<inexistente>/${acao}`, r.status, permitido ? r.status === 404 : r.status === 403, permitido ? "(permitido → alerta não existe)" : "(sem permissão)");
  }
}

// 7) Alerta técnico específico (perfil de clínica não pode ver/operar; plataforma sim)
if (TECNICO) {
  const g = await chamar("GET", `/api/alertas/${TECNICO}`);
  registrar("alerta técnico [TESTE]: detalhe", g.status, esperado.tecnicos ? g.status === 200 : g.status === 404, esperado.tecnicos ? "" : "(clínica: 404)");
  const r = await chamar("POST", `/api/alertas/${TECNICO}/resolver`);
  registrar("alerta técnico [TESTE]: perfil sem alertas.tecnicos não opera", r.status, esperado.tecnicos ? r.status === 200 || r.status === 409 : r.status === 404 || r.status === 403);
}

// 8) Ações reais em alerta [TESTE] (só se --alerta)
if (ALERTA) {
  const antes = await chamar("GET", `/api/alertas/${ALERTA}`);
  registrar("alerta [TESTE] visível para este perfil", antes.status, antes.status === 200, `(status: ${antes.json?.alerta?.status ?? "?"})`);
  if (antes.status === 200 && antes.json.alerta.status === "aberto") {
    const a1 = await chamar("POST", `/api/alertas/${ALERTA}/assumir`);
    registrar("assumir → 200 e status assumido", a1.status, a1.status === 200 && a1.json?.status === "assumido");
    const a2 = await chamar("POST", `/api/alertas/${ALERTA}/assumir`);
    registrar("assumir de novo → 409 (transição inválida)", a2.status, a2.status === 409);
    const r1 = await chamar("POST", `/api/alertas/${ALERTA}/resolver`);
    registrar("resolver → 200 e status resolvido", r1.status, r1.status === 200 && r1.json?.status === "resolvido");
    const r2 = await chamar("POST", `/api/alertas/${ALERTA}/resolver`);
    registrar("resolver de novo → 409", r2.status, r2.status === 409);
    const dep = await chamar("GET", `/api/alertas/${ALERTA}`);
    const h = (dep.json?.historico ?? []).map((x) => x.evento);
    registrar("histórico registra criado → assumido → resolvido", dep.status, ["criado", "assumido", "resolvido"].every((e) => h.includes(e)), `(${h.join(" → ")})`);
  } else {
    linhas.push("AVISO  o alerta informado não está 'aberto' — nada foi alterado.");
  }
}

console.log(`\nAlertas E2E — perfil ${PERFIL} (${USUARIO}) em ${BASE}\n`);
console.log(linhas.join("\n"));
console.log(`\n${falhas === 0 ? "TUDO PASSOU" : `${falhas} FALHA(S)`}`);
process.exit(falhas === 0 ? 0 : 1);
