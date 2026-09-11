/**
 * Camada de analytics do site — fina, sem dependência, no-op segura.
 *
 * `track(evento, params)` empurra um evento pro `window.dataLayer` (padrão
 * GTM) e, se existir, pro `window.gtag` (GA4). Enquanto não houver
 * `NEXT_PUBLIC_GTM_ID` / `NEXT_PUBLIC_GA4_ID` configurado (ver
 * `src/components/Analytics.tsx`), `window.dataLayer` ainda é populado —
 * fica pronto pra quando a tag entrar, e é o que a suíte E2E inspeciona.
 *
 * REGRA DE PRIVACIDADE: `track` NUNCA recebe PII. Só slugs de opção, números
 * de etapa, flags e durações. Os chamadores (hoje: o formulário do
 * Diagnóstico) passam apenas isso. Como reforço, `track` só deixa passar
 * chaves `[a-z0-9_]` e corta strings em 64 caracteres.
 */

type Primitive = string | number | boolean;
export type TrackParams = Record<string, Primitive | undefined>;

const SAFE_KEY = /^[a-z][a-z0-9_]*$/;

type AnalyticsWindow = Window & {
  dataLayer?: Record<string, unknown>[];
  gtag?: (...args: unknown[]) => void;
};

function sanitizeParams(params: TrackParams): Record<string, Primitive> {
  const out: Record<string, Primitive> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || !SAFE_KEY.test(k)) continue;
    out[k] = typeof v === "string" ? v.slice(0, 64) : v;
  }
  return out;
}

/** Registra um evento de produto. Seguro em SSR e sem tag configurada. */
export function track(event: string, params: TrackParams = {}): void {
  if (typeof window === "undefined") return;
  const payload = { event, ...sanitizeParams(params) };
  try {
    const w = window as AnalyticsWindow;
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push(payload);
    if (typeof w.gtag === "function") {
      const { event: _evt, ...rest } = payload;
      void _evt;
      w.gtag("event", event, rest);
    }
  } catch {
    /* analytics nunca pode quebrar a experiência */
  }
}
