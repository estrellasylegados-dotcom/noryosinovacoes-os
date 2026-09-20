"use client";
import { useEffect, useState } from "react";
import type { NoAcaoComercial } from "@/lib/fluxo-tipos";

type Opcao = { id: string; nome: string };
export type OpcoesComerciais = { pipelines: Opcao[]; etapas: (Opcao & { pipeline_id: string; tipo: string })[]; motivos: Opcao[]; canais: Opcao[] };
const input = "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-2 text-sm";
export function useOpcoesComerciais() {
  const [opcoes, setOpcoes] = useState<OpcoesComerciais | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => { let vivo = true; fetch("/api/fluxos/opcoes-comerciais").then(async r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(r => { if (vivo && r.ok) setOpcoes(r); else if (vivo) setErro(true); }).catch(() => { if (vivo) setErro(true); }); return () => { vivo = false; }; }, []);
  return { opcoes, erro };
}
export function SeletorComercial({ label, valor, opcoes, mudar, vazio = "Selecione…" }: { label: string; valor: string; opcoes: Opcao[]; mudar: (v: string) => void; vazio?: string }) {
  return <label className="block text-xs font-medium text-neutral-600">{label}<select className={input} value={valor} onChange={e => mudar(e.target.value)}>
    <option value="">{vazio}</option>{opcoes.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
  </select></label>;
}
export function CamposGatilhoComercial({ config, mudar, opcoes }: { config: Record<string, unknown>; mudar: (c: Record<string, unknown>) => void; opcoes: OpcoesComerciais }) {
  const patch = (p: Record<string, unknown>) => mudar({ ...config, ...p });
  const modo = String(config.modo ?? "entrada");
  return <div className="space-y-3">
    <SeletorComercial label="Quando a oportunidade…" valor={modo} mudar={modo => patch({ modo })} opcoes={[
      {id:"entrada",nome:"Entrar em uma etapa"},{id:"saida",nome:"Sair de uma etapa"},{id:"permanencia",nome:"Permanecer um tempo na etapa"},{id:"convertida",nome:"For convertida"},{id:"perdida",nome:"For perdida"}]} />
    <SeletorComercial label="Pipeline" valor={String(config.pipelineId ?? "")} opcoes={opcoes.pipelines} mudar={pipelineId => patch({ pipelineId, etapaId: "" })} />
    {!["convertida","perdida"].includes(modo) && <SeletorComercial label="Etapa" valor={String(config.etapaId ?? "")} opcoes={opcoes.etapas.filter(e => e.pipeline_id === config.pipelineId)} mudar={etapaId => patch({ etapaId })} />}
    {modo === "permanencia" && <CampoDuracao segundos={Number(config.tempoSegundos ?? 86400)} mudar={tempoSegundos => patch({ tempoSegundos })} />}
    <SeletorComercial label="Repetir esta automação" valor={String(config.reentrada ?? "por_entrada")} mudar={reentrada => patch({reentrada})} opcoes={[
      {id:"por_entrada",nome:"Uma vez por entrada na etapa"},{id:"uma_vez",nome:"Uma vez por oportunidade"},{id:"sempre",nome:"A cada ocorrência elegível"}]} />
    {([['pararAoSair','Parar se mudar de etapa',true],['pararAoResponder','Parar o acompanhamento se o paciente responder',true],['respeitarHorario','Respeitar horário de atendimento nos envios',true],['aceitarOrigemAutomacao','Aceitar mudanças feitas por outras automações',false]] as const).map(([chave,label,padrao]) =>
      <label key={chave} className="flex gap-2 text-xs text-neutral-600"><input type="checkbox" checked={typeof config[chave] === 'boolean' ? config[chave] as boolean : padrao} onChange={e=>patch({[chave]:e.target.checked})} />{label}</label>)}
    <p className="text-xs text-neutral-500">Vale para novas ocorrências após ativar. Converter ou perder encerra sequências incompatíveis. Sem horário configurado, não há restrição de expediente.</p>
  </div>;
}
export function CampoDuracao({ segundos, mudar }: { segundos: number; mudar: (n:number)=>void }) {
  const [unidade, setUnidade] = useState(segundos % 86400 === 0 ? 86400 : segundos % 3600 === 0 ? 3600 : segundos % 60 === 0 ? 60 : 1);
  return <label className="block text-xs font-medium text-neutral-600">Aguardar<div className="flex gap-2">
    <input aria-label="Quantidade de tempo" type="number" min={1} max={366*86400/unidade} className={input} value={segundos/unidade} onChange={e=>mudar(Math.max(1,Number(e.target.value))*unidade)} />
    <select aria-label="Unidade de tempo" className={input} value={unidade} onChange={e=>{const u=Number(e.target.value);setUnidade(u);mudar(Math.max(1,segundos/unidade)*u);}}>
      <option value={1}>segundos</option><option value={60}>minutos</option><option value={3600}>horas</option><option value={86400}>dias</option>
    </select></div></label>;
}
export function CamposAcaoComercial({ no, mudar, opcoes, pipelineId, atendentes }: { no: NoAcaoComercial; mudar:(n:NoAcaoComercial)=>void; opcoes:OpcoesComerciais; pipelineId:string; atendentes:Opcao[] }) {
  return <div className="space-y-3">
    <SeletorComercial label="Ação" valor={no.acao} mudar={v=>mudar({...no,acao:v as NoAcaoComercial['acao'],valor:""})} opcoes={[
      {id:'alerta',nome:'Criar alerta na Central'},{id:'mover_oportunidade',nome:'Mover oportunidade'},{id:'responsavel',nome:'Alterar responsável da oportunidade'},
      {id:'interesse',nome:'Atualizar interesse da oportunidade'},{id:'nota',nome:'Registrar nota interna'}]} />
    {no.acao === 'mover_oportunidade' ? <>
      <SeletorComercial label="Etapa de destino" valor={no.valor} opcoes={opcoes.etapas.filter(e=>e.pipeline_id===pipelineId)} mudar={valor=>mudar({...no,valor})} />
      {opcoes.etapas.find(e=>e.id===no.valor)?.tipo === 'lost' && <SeletorComercial label="Motivo da perda" valor={no.motivoPerdaId??''} opcoes={opcoes.motivos} mudar={motivoPerdaId=>mudar({...no,motivoPerdaId})} />}
    </> : no.acao === 'responsavel' ? <SeletorComercial label="Responsável" valor={no.valor} opcoes={atendentes} vazio="Sem responsável" mudar={valor=>mudar({...no,valor})} /> :
      <label className="block text-xs font-medium text-neutral-600">{no.acao==='interesse'?'Interesse':'Texto'}<textarea maxLength={no.acao==='interesse'?120:2000} rows={4} className={input} value={no.valor} onChange={e=>mudar({...no,valor:e.target.value})} /></label>}
  </div>;
}
