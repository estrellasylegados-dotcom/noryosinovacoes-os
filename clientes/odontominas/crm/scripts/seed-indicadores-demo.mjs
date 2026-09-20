/**
 * Massa idempotente para o painel de Indicadores.
 * Cria apenas dados [DEMO] diretamente no Supabase; não chama APIs do CRM,
 * não envia mensagens e não dispara fluxos. Sem --apply, faz somente o plano.
 *
 * Uso:
 *   node scripts/seed-indicadores-demo.mjs
 *   node scripts/seed-indicadores-demo.mjs --apply
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const aplicar = process.argv.includes("--apply");
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((linha) => linha && !linha.startsWith("#") && linha.includes("="))
    .map((linha) => [
      linha.slice(0, linha.indexOf("=")).trim(),
      linha.slice(linha.indexOf("=") + 1).trim().replace(/^["']|["']$/g, ""),
    ])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const consultar = async (consulta, nome) => {
  const resposta = await consulta;
  if (resposta.error) throw new Error(`${nome}: ${resposta.error.code ?? resposta.error.message}`);
  return resposta.data;
};
const normalizar = (valor) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const uuid = (grupo, indice) => `d3e${grupo}0000-0000-4000-8000-${indice.toString(16).padStart(12, "0")}`;
const iso = (data) => data.toISOString();

const clinica = await consultar(db.from("clinicas").select("id,nome").eq("slug", "odontominas").single(), "clínica");
const pipeline = await consultar(
  db.from("pipelines").select("id,nome").eq("clinica_id", clinica.id).eq("padrao", true).single(),
  "pipeline padrão"
);
const [estagios, canais, atendentes] = await Promise.all([
  consultar(db.from("pipeline_estagios").select("id,nome,tipo,ordem").eq("pipeline_id", pipeline.id).eq("ativo", true).order("ordem"), "estágios"),
  consultar(db.from("canais").select("id,nome").eq("clinica_id", clinica.id).eq("ativo", true).order("nome"), "canais"),
  consultar(db.from("atendentes").select("id,nome,perfil,status").eq("clinica_id", clinica.id).eq("status", "active").order("nome"), "equipe"),
]);

const pessoas = atendentes.filter((item) => ["dona", "gerente", "supervisora", "atendente"].includes(item.perfil));
if (canais.length === 0 || pessoas.length === 0) throw new Error("É necessário ter ao menos um canal e uma pessoa operacional ativa.");
const porNome = new Map(estagios.map((item) => [normalizar(item.nome), item]));
const nomesObrigatorios = ["novo", "em atendimento", "qualificado", "agendado", "follow-up", "convertido", "perdido"];
for (const nome of nomesObrigatorios) if (!porNome.has(nome)) throw new Error(`Estágio obrigatório ausente: ${nome}`);

const cenariosBase = [
  ...Array(12).fill("novo"),
  ...Array(10).fill("em atendimento"),
  ...Array(10).fill("qualificado"),
  ...Array(8).fill("agendado"),
  ...Array(8).fill("follow-up"),
  ...Array(16).fill("convertido"),
  ...Array(8).fill("perdido"),
];
// Permutação coprima com 72: preserva os totais e espalha os resultados no tempo.
const cenarios = Array.from({ length: cenariosBase.length }, (_, indice) => cenariosBase[(indice * 29) % cenariosBase.length]);
const caminhos = {
  novo: ["novo"],
  "em atendimento": ["novo", "em atendimento"],
  qualificado: ["novo", "em atendimento", "qualificado"],
  agendado: ["novo", "em atendimento", "qualificado", "agendado"],
  "follow-up": ["novo", "em atendimento", "qualificado", "follow-up"],
  convertido: ["novo", "em atendimento", "qualificado", "agendado", "convertido"],
  perdido: ["novo", "em atendimento", "qualificado", "perdido"],
};
const origens = ["Google Ads", "Instagram", "Indicação", "Site", "WhatsApp orgânico"];
const interesses = ["Implante dentário", "Aparelho ortodôntico", "Avaliação odontológica", "Clareamento", "Prótese dentária"];
const atrasosResposta = [4, 7, 11, 16, 24, 33];
const agora = new Date();
const pacientes = [];
const conversas = [];
const oportunidades = [];
const historico = [];
const mensagens = [];

for (let posicao = 0; posicao < cenarios.length; posicao++) {
  const numero = posicao + 1;
  const finalNome = cenarios[posicao];
  const caminho = caminhos[finalNome];
  const diasAtras = numero <= 24 ? numero % 7 : numero <= 48 ? 7 + (numero % 23) : 30 + (numero % 60);
  const criadoEm = new Date(agora.getTime() - diasAtras * 86_400_000 - (8 + (numero % 8)) * 3_600_000);
  const pessoa = numero % 9 === 0 ? null : pessoas[posicao % pessoas.length];
  const canal = canais[posicao % canais.length];
  const pacienteId = uuid("0", numero);
  const conversaId = uuid("1", numero);
  const oportunidadeId = uuid("2", numero);
  const telefone = `55000009${numero.toString().padStart(5, "0")}`;
  const origem = origens[posicao % origens.length];
  const status = finalNome === "convertido" ? "won" : finalNome === "perdido" ? "lost" : "open";
  const eventos = caminho.map((nome, indice) => ({ nome, data: new Date(criadoEm.getTime() + indice * 3_600_000) }));
  const final = eventos.at(-1);
  const respondeu = Boolean(pessoa) && numero % 5 !== 0;
  const recebidaEm = new Date(criadoEm.getTime() + 5 * 60_000);
  const respostaEm = new Date(recebidaEm.getTime() + atrasosResposta[posicao % atrasosResposta.length] * 60_000);

  pacientes.push({
    id: pacienteId,
    clinica_id: clinica.id,
    nome: `[DEMO] Paciente ${numero.toString().padStart(3, "0")}`,
    telefone,
    email: `demo.indicadores.${numero}@example.invalid`,
    origem_lead: origem,
    utm_source: origem === "Google Ads" ? "google" : origem === "Instagram" ? "instagram" : null,
    created_at: iso(criadoEm),
    updated_at: iso(criadoEm),
  });
  conversas.push({
    id: conversaId,
    clinica_id: clinica.id,
    paciente_id: pacienteId,
    telefone,
    canal: "whatsapp",
    canal_id: canal.id,
    status: status === "won" ? "agendado" : status === "lost" ? "perdido" : respondeu ? "respondido" : "novo",
    primeira_mensagem_em: iso(recebidaEm),
    ultima_mensagem_em: iso(respondeu ? respostaEm : recebidaEm),
    atribuido_a: pessoa?.id ?? null,
    atribuido_em: pessoa ? iso(criadoEm) : null,
    finalizada_em: status === "open" ? null : iso(final.data),
    arquivada: false,
    nao_lida: !respondeu,
    mensagens_nao_lidas: respondeu ? 0 : 1,
    aguardando_desde: respondeu ? null : iso(recebidaEm),
    created_at: iso(criadoEm),
    updated_at: iso(final.data),
  });
  oportunidades.push({
    id: oportunidadeId,
    clinica_id: clinica.id,
    paciente_id: pacienteId,
    pipeline_id: pipeline.id,
    estagio_id: porNome.get(finalNome).id,
    responsavel_id: pessoa?.id ?? null,
    conversa_id: conversaId,
    interesse: interesses[posicao % interesses.length],
    status,
    versao: caminho.length,
    estagio_entrou_em: iso(final.data),
    converted_at: status === "won" ? iso(final.data) : null,
    lost_at: status === "lost" ? iso(final.data) : null,
    motivo_perda_obs: status === "lost" ? "[DEMO] Sem retorno após tentativas de contato" : null,
    created_at: iso(criadoEm),
    updated_at: iso(final.data),
  });
  eventos.forEach((evento, indice) => {
    historico.push({
      id: uuid("5", numero * 10 + indice),
      clinica_id: clinica.id,
      oportunidade_id: oportunidadeId,
      tipo: indice === 0 ? "created" : "stage_changed",
      estagio_de: indice === 0 ? null : porNome.get(eventos[indice - 1].nome).id,
      estagio_para: porNome.get(evento.nome).id,
      responsavel_para: pessoa?.id ?? null,
      ator_id: pessoa?.id ?? null,
      origem: "sistema",
      observacao: "[DEMO] Massa demonstrativa do painel de Indicadores",
      idempotency_key: `demo-indicadores-v1-${indice}`,
      created_at: iso(evento.data),
    });
  });
  mensagens.push({
    id: uuid("3", numero),
    clinica_id: clinica.id,
    conversa_id: conversaId,
    direcao: "recebida",
    tipo: "texto",
    conteudo: "[DEMO] Olá, gostaria de saber mais sobre o tratamento.",
    evolution_message_id: `demo-indicadores-v1-in-${numero}`,
    timestamp_whatsapp: iso(recebidaEm),
    created_at: iso(recebidaEm),
  });
  if (respondeu) mensagens.push({
    id: uuid("4", numero),
    clinica_id: clinica.id,
    conversa_id: conversaId,
    direcao: "enviada",
    tipo: "texto",
    conteudo: "[DEMO] Olá! Vou ajudar você com as informações e o agendamento.",
    evolution_message_id: `demo-indicadores-v1-out-${numero}`,
    enviada_por_atendente_id: pessoa.id,
    timestamp_whatsapp: iso(respostaEm),
    created_at: iso(respostaEm),
  });
}

console.log(`Plano: ${pacientes.length} pacientes, ${conversas.length} conversas, ${mensagens.length} mensagens, ${oportunidades.length} oportunidades e ${historico.length} eventos.`);
const distribuicao = cenarios.reduce((total, nome) => ({ ...total, [nome]: (total[nome] ?? 0) + 1 }), {});
console.log(`Distribuição: ${Object.entries(distribuicao).map(([nome, total]) => `${nome}=${total}`).join(", ")}.`);
console.log(`Dependências: ${canais.length} canal(is), ${pessoas.length} pessoa(s), ${estagios.length} estágio(s).`);
if (!aplicar) {
  console.log("Dry-run concluído. Use --apply para gravar a massa [DEMO].");
  process.exit(0);
}

for (const [tabela, linhas] of [
  ["pacientes", pacientes],
  ["conversas", conversas],
  ["mensagens", mensagens],
  ["oportunidades", oportunidades],
]) {
  for (let inicio = 0; inicio < linhas.length; inicio += 200) {
    await consultar(db.from(tabela).upsert(linhas.slice(inicio, inicio + 200), { onConflict: "id" }), `gravar ${tabela}`);
  }
}
for (let inicio = 0; inicio < oportunidades.length; inicio += 100) {
  await consultar(
    db.from("oportunidade_historico").delete().in("oportunidade_id", oportunidades.slice(inicio, inicio + 100).map((linha) => linha.id)),
    "substituir histórico demonstrativo"
  );
}
for (let inicio = 0; inicio < historico.length; inicio += 200) {
  await consultar(db.from("oportunidade_historico").upsert(historico.slice(inicio, inicio + 200), { onConflict: "id" }), "gravar oportunidade_historico");
}

const contarIds = async (tabela, linhas) => {
  let total = 0;
  for (let inicio = 0; inicio < linhas.length; inicio += 100) {
    const encontrados = await consultar(db.from(tabela).select("id").in("id", linhas.slice(inicio, inicio + 100).map((linha) => linha.id)), `conferir ${tabela}`);
    total += encontrados.length;
  }
  if (total !== linhas.length) throw new Error(`Conferência de ${tabela}: esperado ${linhas.length}, encontrado ${total}`);
  return total;
};
const totais = {};
for (const [tabela, linhas] of [
  ["pacientes", pacientes],
  ["conversas", conversas],
  ["mensagens", mensagens],
  ["oportunidades", oportunidades],
  ["oportunidade_historico", historico],
]) totais[tabela] = await contarIds(tabela, linhas);
console.log(`Aplicação conferida: ${Object.entries(totais).map(([tabela, total]) => `${tabela}=${total}`).join(", ")}.`);
console.log("Nenhuma mensagem externa foi enviada.");
