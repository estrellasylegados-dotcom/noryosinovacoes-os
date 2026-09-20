/**
 * Autorização explícita de Rafael, 2026-09-18: criar conta temporária para
 * validar Alertas, desativar ao final e documentar. Não envia e-mail/WhatsApp.
 * Login HTTP real; senha e cookies somente em memória. Não fabrica sessão.
 * Conta única percorre os seis perfis, com revogação entre eles.
 * Uso: node scripts/e2e-alertas-temporario.mjs --executar-autorizado
 * Recuperação após interrupção: --desativar <uuid> (somente conta deste script).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const BASE = 'https://odontominas-crm-production.up.railway.app';
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)
  .filter(l => l && !l.startsWith('#') && l.includes('='))
  .map(l => [l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g, '')]));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false } });
const PREFIX = '[TESTE TEMP CODEX ALERTAS]';
const onlySupport = process.argv.includes('--somente-suporte');
const reuseId = process.argv.includes('--reusar') ? process.argv[process.argv.indexOf('--reusar')+1] : null;
const report = { inicio:new Date().toISOString(), autorizacao:'Rafael autorizou no chat a criação de conta temporária, testes e desativação final (2026-09-18).', ui:'NÃO VALIDADA: navegador indisponível', perfis:[], verificacoes:[] };
let accountId, clinicId, version = 0;
let password = randomBytes(32).toString('base64url');
const cookies = [];
const fixtures = [];
const check = (nome, ok, status) => { report.verificacoes.push({nome,ok,status}); console.log(`${ok?'PASSOU':'FALHOU'} ${nome}${status ? ` (${status})`:''}`); };
async function query(q, label) { const r = await q; if(r.error) throw new Error(`${label}: ${r.error.code ?? 'erro_backend'}`); return r.data; }
async function audit(evento, detalhes={}) { await query(db.from('auditoria_eventos').insert({clinica_id:clinicId, ator_perfil:'cli', evento, alvo_id:accountId, detalhes:{origem:'e2e-alertas-temporario.mjs', autorizado_por:'Rafael', ...detalhes}}), 'auditoria'); }
async function disable(id) {
  const a = await query(db.from('atendentes').select('id,nome,usuario,clinica_id,sessao_versao').eq('id',id).single(), 'ler conta temporária');
  if(!a.nome.startsWith(PREFIX) || !a.usuario.startsWith('qa_alertas_')) throw new Error('Conta fora do escopo temporário');
  await query(db.from('atendentes').update({status:'disabled', ativo:false, senha_hash:null, perfil:'atendente', papel:'atendente', permissoes_customizadas:null, sessao_versao:a.sessao_versao+1}).eq('id',id), 'desativar');
  accountId=id; clinicId=a.clinica_id;
  await audit('USER_DISABLED', {motivo:'Fim dos testes autorizados; senha removida e sessões revogadas'});
  const final = await query(db.from('atendentes').select('status,ativo,senha_hash,perfil,sessao_versao').eq('id',id).single(), 'conferir desativação');
  check('Conta desativada, sem senha, sem privilégio de plataforma e sessões revogadas', final.status==='disabled' && !final.ativo && final.senha_hash===null && final.perfil==='atendente' && final.sessao_versao>a.sessao_versao);
}
async function request(path, cookie, method='GET', body) {
  const r=await fetch(BASE+path,{method,redirect:'manual',signal:AbortSignal.timeout(45000),headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});
  const json=await r.json().catch(()=>null); return {status:r.status,json,cookie:(r.headers.get('set-cookie')??'').split(';')[0]};
}
async function fixture(template, label) {
  const id=randomUUID();
  await query(db.from('alertas').insert({id,clinica_id:clinicId,tipo:template.tipo,categoria:template.categoria,natureza:template.natureza,severidade:template.severidade,titulo:`${PREFIX} ${label}`,descricao:'Validação temporária autorizada por Rafael.',tipo_entidade:template.tipo_entidade,entidade_id:template.entidade_id,responsavel_id:template.natureza==='tecnico'?null:accountId,chave_deduplicacao:`codex:${id}`,chave_ativa:null,dados:{}}),'criar alerta teste');
  fixtures.push(id);
  await query(db.from('alerta_historico').insert({alerta_id:id,clinica_id:clinicId,evento:'criado',origem:'sistema',motivo:'teste_temporario_autorizado'}),'histórico teste');
  return id;
}
async function runExisting(usuario, perfil, alerta, tecnico) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['scripts/e2e-alertas-sessao.mjs','--usuario',usuario,'--perfil',perfil,'--alerta',alerta,'--tecnico',tecnico],{cwd:new URL('..',import.meta.url),stdio:['pipe','pipe','pipe']});
    let out=''; child.stdout.on('data',d=>out+=d); child.stderr.on('data',()=>{}); child.on('error',reject);
    const timer=setTimeout(()=>child.kill(),240000);
    child.on('close',code=>{clearTimeout(timer);const lines=out.split(/\r?\n/).filter(l=>/^(PASSOU|FALHOU|AVISO|TUDO PASSOU|\d+ FALHA)/.test(l));resolve({perfil,code,linhas:lines});});
    child.stdin.end(password+'\n');
  });
}
if(process.argv.includes('--desativar')) { await disable(process.argv[process.argv.indexOf('--desativar')+1]); process.exit(0); }
if(!process.argv.includes('--executar-autorizado')) throw new Error('Use --executar-autorizado apenas para a autorização documentada');
try {
  const clinic=await query(db.from('clinicas').select('id').eq('slug','odontominas').single(),'clínica'); clinicId=clinic.id;
  const templates=await query(db.from('alertas').select('id,tipo,categoria,natureza,severidade,tipo_entidade,entidade_id').eq('clinica_id',clinicId).like('titulo','[TESTE UI%'),'modelos TESTE UI');
  const op=templates.find(a=>a.tipo==='sla_limite'); const tech=templates.find(a=>a.natureza==='tecnico');
  if(!op || !tech) throw new Error('Modelos de teste não encontrados');
  let usuario=`qa_alertas_${Date.now()}`;
  if(reuseId) {
    const previous=await query(db.from('atendentes').select('id,nome,usuario,status,clinica_id,sessao_versao').eq('id',reuseId).single(),'reusar conta temporária');
    if(!previous.nome.startsWith(PREFIX)||!previous.usuario.startsWith('qa_alertas_')||previous.status!=='disabled'||previous.clinica_id!==clinicId) throw new Error('Reuso fora do escopo temporário');
    accountId=previous.id; usuario=previous.usuario; version=previous.sessao_versao;
  } else accountId=randomUUID();
  report.conta={id:accountId,usuario};
  const salt=randomBytes(16).toString('hex'); const hash=`${salt}:${scryptSync(password,salt,64).toString('hex')}`;
  if(reuseId) await query(db.from('atendentes').update({senha_hash:hash}).eq('id',accountId),'credencial temporária em memória');
  else await query(db.from('atendentes').insert({id:accountId,clinica_id:clinicId,nome:`${PREFIX} temporária`,usuario,email:null,senha_hash:hash,perfil:'atendente',papel:'atendente',status:'disabled',ativo:false,sessao_versao:version}),'criar conta temporária');
  console.log(`Conta temporária: ${accountId} (${usuario})`);
  await audit('TEST_ACCOUNT_AUTHORIZED', {escopo:'Central de Alertas, seis perfis, login real, desativação ao final'});
  for(const perfil of (onlySupport ? ['noryos_suporte'] : ['dona','gerente','supervisora','atendente','noryos_suporte','noryos_admin'])) {
    version++;
    await query(db.from('atendentes').update({perfil,papel:['dona','noryos_admin'].includes(perfil)?'admin':'atendente',status:'active',ativo:true,sessao_versao:version}).eq('id',accountId),'perfil temporário');
    await audit('ROLE_CHANGED',{perfil,temporario:true});
    const alerta=await fixture(perfil==='noryos_suporte'?tech:op,`${perfil} assumir/resolver`), tecnico=await fixture(tech,`${perfil} técnico`);
    const result=await runExisting(usuario,perfil,alerta,tecnico); report.perfis.push(result); console.log(`\n${perfil}:\n${result.linhas.join('\n')}`);
    const login=await request('/api/login',null,'POST',{usuario,senha:password});
    if(login.status!==200 || !login.cookie) throw new Error(`Login ${perfil}: ${login.status}`);
    cookies.push(login.cookie);
    const ignore=await fixture(op,`${perfil} ignorar`);
    const ignored=await request(`/api/alertas/${ignore}/ignorar`,login.cookie,'POST',{motivo:'Teste temporário autorizado por Rafael'});
    const canIgnore=['dona','gerente','noryos_admin'].includes(perfil);
    check(`${perfil}: ignorar alerta`, canIgnore?ignored.status===200&&ignored.json?.status==='ignorado':ignored.status===403,ignored.status);
    if(canIgnore){const history=await request(`/api/alertas/${ignore}`,login.cookie);check(`${perfil}: histórico de ignorar`, history.json?.historico?.some(h=>h.evento==='ignorado')===true);}
  }
} catch(e) { report.erro=e.message; console.log(`ERRO: ${e.message}`); process.exitCode=1; }
finally {
  if(accountId) {
    try {
      await disable(accountId);
      for(const [i,cookie] of cookies.entries()) {const r=await request('/api/alertas',cookie);check(`Sessão anterior ${i+1} recusada após desativação`,r.status===401,r.status);}
      const login=await request('/api/login',null,'POST',{usuario:report.conta?.usuario,senha:password});check('Novo login recusado após desativação',login.status===401,login.status);
      if(fixtures.length) await query(db.from('alertas').update({status:'resolvido',resolvido_em:new Date().toISOString(),resolvido_por_evento:'fim_teste_temporario'}).in('id',fixtures).in('status',['aberto','assumido']),'encerrar fixtures temporárias');
      report.desativada=true;
    } catch(e) {report.erroDesativacao=e.message; console.log(`ATENÇÃO: verificar desativação ${accountId}: ${e.message}`);process.exitCode=1;}
  }
  password=''; report.alertasCriados=fixtures; report.fim=new Date().toISOString();
  writeFileSync(new URL(`../docs/alertas-e2e-temporario-2026-09-18${onlySupport?'-suporte':''}.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');
}
if(report.perfis.some(p=>p.code!==0)||report.verificacoes.some(v=>!v.ok)) process.exitCode=1;
