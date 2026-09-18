// Prova de concorrência de assumir/transferir/desatribuir contra o banco REAL.
// Mock não prova atomicidade: aqui cada par de chamadas sai em paralelo (Promise.all)
// por requisições HTTP separadas = conexões separadas no Postgres.
//
// Uso (na pasta crm/):  node scripts/e2e-canais-concorrencia.mjs
// Lê NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do .env.local. Nunca imprime segredo.
// Cria SÓ dados "[TESTE]" (telefones 5500000000xxx) e não apaga nada: a limpeza é decisão do dono.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")])
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const RODADAS = Number(process.argv[2] ?? 20);
const AGUARDANDO_DESDE = "2026-09-19T09:00:00.000Z";

const { data: clinica } = await supabase.from("clinicas").select("id").limit(1).single();
const { data: canal } = await supabase.from("canais").select("id").eq("provider_instance_id", "teste-recepcao").single();
const { data: quem } = await supabase.from("atendentes").select("id, usuario").in("usuario", ["teste_atendente_a", "teste_atendente_b", "teste_supervisora"]);
const id = (u) => quem.find((a) => a.usuario === u).id;
const [A, B, SUP] = [id("teste_atendente_a"), id("teste_atendente_b"), id("teste_supervisora")];

let falhas = 0;
const confere = (cond, msg) => {
  if (!cond) {
    falhas++;
    console.log("  FALHOU:", msg);
  }
};

async function novaConversa(tel) {
  const { data, error } = await supabase
    .from("conversas")
    .insert({ clinica_id: clinica.id, canal_id: canal.id, telefone: tel, status: "novo", aguardando_desde: AGUARDANDO_DESDE, primeira_mensagem_em: AGUARDANDO_DESDE, ultima_mensagem_em: AGUARDANDO_DESDE })
    .select("id")
    .single();
  if (error) throw new Error("insert conversa: " + error.code);
  return data.id;
}
const assumir = (conv, ator) => supabase.rpc("assumir_conversa", { p_clinica: clinica.id, p_conversa: conv, p_ator: ator }).then((r) => r.data);
const transferir = (conv, ator, esperado, destino) =>
  supabase.rpc("transferir_conversa", { p_clinica: clinica.id, p_conversa: conv, p_ator: ator, p_esperado: esperado, p_destino: destino, p_motivo: null, p_forcar: false }).then((r) => r.data);
const estado = async (conv) => (await supabase.from("conversas").select("atribuido_a, aguardando_desde, status").eq("id", conv).single()).data;
const eventos = async (conv, tipo) => (await supabase.from("conversa_eventos").select("id").eq("conversa_id", conv).eq("tipo", tipo)).data.length;

const base = Date.now() % 100000;
console.log(`Corrida real: ${RODADAS} rodadas de "assumir" (A x B x Supervisora) + ${RODADAS} de "transferência cruzada".`);

// 1) três pessoas assumindo AO MESMO TEMPO a mesma conversa
let vitoriasA = 0, vitoriasB = 0, vitoriasS = 0;
for (let i = 0; i < RODADAS; i++) {
  const conv = await novaConversa(`5500000${String(1000 + i + base).slice(-6)}`.slice(0, 13));
  const resultados = await Promise.all([assumir(conv, A), assumir(conv, B), assumir(conv, SUP)]);
  const oks = resultados.filter((r) => r.ok && !r.ja_era_sua);
  const conflitos = resultados.filter((r) => !r.ok && r.error === "ja_assumida");
  confere(oks.length === 1, `rodada ${i}: esperava exatamente 1 sucesso, veio ${oks.length}`);
  confere(conflitos.length === 2, `rodada ${i}: esperava 2 conflitos, vieram ${conflitos.length}`);
  const e = await estado(conv);
  const vencedor = [A, B, SUP][resultados.findIndex((r) => r.ok)];
  confere(e.atribuido_a === vencedor, `rodada ${i}: banco diz ${e.atribuido_a}, vencedor foi ${vencedor}`);
  confere((await eventos(conv, "CONVERSATION_ASSIGNED")) === 1, `rodada ${i}: histórico com != 1 evento ASSIGNED`);
  confere(conflitos.every((c) => c.por_id === vencedor), `rodada ${i}: conflito não aponta o vencedor`);
  confere(e.aguardando_desde === new Date(AGUARDANDO_DESDE).toISOString().replace("Z", "+00:00") || new Date(e.aguardando_desde).toISOString() === AGUARDANDO_DESDE, `rodada ${i}: SLA (aguardando_desde) foi alterado`);
  confere(e.status === "novo", `rodada ${i}: status foi alterado pelo assumir`);
  if (vencedor === A) vitoriasA++; else if (vencedor === B) vitoriasB++; else vitoriasS++;
}
console.log(`  assumir: vitórias A=${vitoriasA} B=${vitoriasB} Supervisora=${vitoriasS} (a corrida é real quando mais de um lado vence em rodadas diferentes)`);

// 2) transferência cruzada: A→B e Supervisora→(ela mesma) ao mesmo tempo, ambas vendo "A" como responsável
let transfB = 0, transfS = 0;
for (let i = 0; i < RODADAS; i++) {
  const conv = await novaConversa(`5500001${String(1000 + i + base).slice(-6)}`.slice(0, 13));
  await assumir(conv, A);
  const [r1, r2] = await Promise.all([transferir(conv, A, A, B), transferir(conv, SUP, A, SUP)]);
  const oks = [r1, r2].filter((r) => r.ok);
  confere(oks.length === 1, `transf ${i}: esperava exatamente 1 sucesso, veio ${oks.length}`);
  const perdedor = r1.ok ? r2 : r1;
  confere(perdedor.error === "conflito", `transf ${i}: perdedor sem conflito controlado (${perdedor.error})`);
  const e = await estado(conv);
  const vencedor = r1.ok ? B : SUP;
  confere(e.atribuido_a === vencedor, `transf ${i}: estado final inconsistente`);
  confere(perdedor.por_id === vencedor, `transf ${i}: conflito não informa o novo responsável`);
  confere((await eventos(conv, "CONVERSATION_TRANSFERRED")) === 1, `transf ${i}: != 1 evento TRANSFERRED`);
  confere(new Date(e.aguardando_desde).toISOString() === AGUARDANDO_DESDE, `transf ${i}: SLA alterado pela transferência`);
  if (r1.ok) transfB++; else transfS++;
}
console.log(`  transferência: A→B venceu ${transfB}x, Supervisora venceu ${transfS}x`);

// 3) destino inválido e devolução à fila
const conv = await novaConversa(`5500002${String(base).padStart(6, "0")}`.slice(0, 13));
await assumir(conv, A);
const semClinica = await transferir(conv, A, A, "00000000-0000-0000-0000-000000000000");
confere(!semClinica.ok && semClinica.error === "destino_invalido", "destino inexistente deveria ser inválido");
const devolveu = await supabase.rpc("desatribuir_conversa", { p_clinica: clinica.id, p_conversa: conv, p_ator: A, p_esperado: A, p_motivo: null }).then((r) => r.data);
confere(devolveu.ok, "devolver à fila falhou");
const devolveuDeNovo = await supabase.rpc("desatribuir_conversa", { p_clinica: clinica.id, p_conversa: conv, p_ator: A, p_esperado: A, p_motivo: null }).then((r) => r.data);
confere(!devolveuDeNovo.ok, "devolver duas vezes deveria conflitar");

console.log(falhas === 0 ? "RESULTADO: OK — exatamente 1 vencedor em toda corrida, estado e histórico consistentes, SLA intacto." : `RESULTADO: ${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
