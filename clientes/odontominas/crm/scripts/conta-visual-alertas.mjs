#!/usr/bin/env node
/**
 * Conta temporária para validação visual autenticada da Central de Alertas.
 * Autorização: Rafael, 2026-09-19, no chat. A senha entra por stdin, fica só
 * em memória e nunca é impressa nem gravada fora do hash. O script só altera
 * contas cujo nome/usuário tenham o prefixo exclusivo abaixo.
 *
 * Uso:
 *   node scripts/conta-visual-alertas.mjs criar
 *   node scripts/conta-visual-alertas.mjs perfil <id> <dona|noryos_suporte>
 *   node scripts/conta-visual-alertas.mjs desativar <id>
 */
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const PREFIXO_NOME = "[TESTE UI CODEX ALERTAS]";
const PREFIXO_USUARIO = "qa_ui_alertas_";
const comando = process.argv[2];
const idArg = process.argv[3];
const perfilArg = process.argv[4];

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

async function executar(query, contexto) {
  const resposta = await query;
  if (resposta.error) throw new Error(`${contexto}: ${resposta.error.code ?? "erro_backend"}`);
  return resposta.data;
}

async function clinicaId() {
  const clinica = await executar(db.from("clinicas").select("id").eq("slug", "odontominas").single(), "clínica");
  return clinica.id;
}

async function contaTemporaria(id) {
  const conta = await executar(
    db.from("atendentes").select("id,nome,usuario,clinica_id,status,sessao_versao").eq("id", id).single(),
    "conta"
  );
  if (!conta.nome.startsWith(PREFIXO_NOME) || !conta.usuario.startsWith(PREFIXO_USUARIO)) {
    throw new Error("Conta fora do escopo temporário deste roteiro");
  }
  return conta;
}

async function auditar(clinica_id, alvo_id, evento, detalhes) {
  await executar(
    db.from("auditoria_eventos").insert({
      clinica_id,
      ator_perfil: "cli",
      evento,
      alvo_id,
      detalhes: { origem: "conta-visual-alertas.mjs", autorizado_por: "Rafael", ...detalhes },
    }),
    "auditoria"
  );
}

if (comando === "criar") {
  let senha = "";
  for await (const trecho of process.stdin) senha += trecho;
  senha = senha.trim();
  if (senha.length < 16) throw new Error("Senha temporária precisa ter ao menos 16 caracteres");

  const clinica_id = await clinicaId();
  const id = randomUUID();
  const usuario = `${PREFIXO_USUARIO}${Date.now()}`;
  const salt = randomBytes(16).toString("hex");
  const senha_hash = `${salt}:${scryptSync(senha, salt, 64).toString("hex")}`;
  senha = "";

  await executar(
    db.from("atendentes").insert({
      id,
      clinica_id,
      nome: `${PREFIXO_NOME} temporária`,
      usuario,
      email: null,
      senha_hash,
      perfil: "dona",
      papel: "admin",
      status: "active",
      ativo: true,
      sessao_versao: 0,
    }),
    "criação"
  );
  await auditar(clinica_id, id, "TEST_ACCOUNT_AUTHORIZED", {
    escopo: "Validação visual da Central de Alertas; desativação obrigatória ao final",
  });
  console.log(JSON.stringify({ id, usuario, perfil: "dona", status: "active" }));
} else if (comando === "perfil") {
  if (!idArg || !["dona", "noryos_suporte"].includes(perfilArg)) throw new Error("Perfil temporário inválido");
  const conta = await contaTemporaria(idArg);
  const novaVersao = Number(conta.sessao_versao ?? 0) + 1;
  await executar(
    db.from("atendentes").update({
      perfil: perfilArg,
      papel: perfilArg === "dona" ? "admin" : "atendente",
      status: "active",
      ativo: true,
      sessao_versao: novaVersao,
      permissoes_customizadas: null,
    }).eq("id", idArg),
    "troca de perfil"
  );
  await auditar(conta.clinica_id, idArg, "ROLE_CHANGED", { perfil: perfilArg, temporario: true });
  console.log(JSON.stringify({ id: idArg, usuario: conta.usuario, perfil: perfilArg, status: "active" }));
} else if (comando === "desativar") {
  if (!idArg) throw new Error("Informe o id");
  const conta = await contaTemporaria(idArg);
  const novaVersao = Number(conta.sessao_versao ?? 0) + 1;
  await executar(
    db.from("atendentes").update({
      perfil: "atendente",
      papel: "atendente",
      status: "disabled",
      ativo: false,
      senha_hash: null,
      permissoes_customizadas: null,
      sessao_versao: novaVersao,
    }).eq("id", idArg),
    "desativação"
  );
  await auditar(conta.clinica_id, idArg, "USER_DISABLED", {
    motivo: "Fim da validação visual autorizada; senha removida e sessões revogadas",
  });
  console.log(JSON.stringify({ id: idArg, usuario: conta.usuario, perfil: "atendente", status: "disabled", senhaRemovida: true }));
} else {
  throw new Error("Use: criar | perfil <id> <dona|noryos_suporte> | desativar <id>");
}
