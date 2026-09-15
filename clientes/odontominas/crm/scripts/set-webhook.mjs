/**
 * set-webhook — aponta o webhook da instância Evolution API pro endpoint
 * /api/webhook/evolution deste CRM. Escreve, não só lê: confirme a URL
 * antes de rodar.
 *
 * Uso (de dentro de crm/, com as env vars carregadas do .env.local):
 *   node --env-file=.env.local scripts/set-webhook.mjs <url-publica-completa>
 *   ex.: node --env-file=.env.local scripts/set-webhook.mjs https://xxxx.trycloudflare.com/api/webhook/evolution
 *
 * Lê:  process.env.EVOLUTION_API_URL, process.env.EVOLUTION_API_KEY
 *      process.env.EVOLUTION_INSTANCE (default: "odontominas-teste")
 *
 * NUNCA imprime a key. Só status HTTP e corpo da resposta da Evolution.
 */

const INSTANCE = process.env.EVOLUTION_INSTANCE || "odontominas-teste";
const targetUrl = process.argv[2];

if (!targetUrl) {
  console.error("Uso: node --env-file=.env.local scripts/set-webhook.mjs <url-publica-do-endpoint>");
  process.exit(1);
}

const apiUrl = process.env.EVOLUTION_API_URL;
const apiKey = process.env.EVOLUTION_API_KEY;

if (!apiUrl || !apiKey) {
  console.error("Faltam EVOLUTION_API_URL / EVOLUTION_API_KEY no ambiente (rode com --env-file=.env.local).");
  process.exit(1);
}

const res = await fetch(`${apiUrl}/webhook/set/${INSTANCE}`, {
  method: "POST",
  headers: { apikey: apiKey, "Content-Type": "application/json" },
  body: JSON.stringify({
    webhook: {
      enabled: true,
      url: targetUrl,
      byEvents: false,
      base64: false,
      events: ["MESSAGES_UPSERT"],
    },
  }),
});

const body = await res.text();
console.log(`instância: ${INSTANCE}`);
console.log(`status: ${res.status}`);
console.log(body);

if (!res.ok) process.exit(1);
