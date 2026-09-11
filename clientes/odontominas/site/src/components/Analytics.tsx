import Script from "next/script";
import { analyticsConfig } from "@/lib/config";

/**
 * Carregador de tag de analytics — **inerte até ser configurado**.
 *
 * Sem `NEXT_PUBLIC_GTM_ID` nem `NEXT_PUBLIC_GA4_ID` (estado atual), não
 * renderiza nada: zero script, zero rede. Os eventos de produto continuam
 * sendo empurrados pro `window.dataLayer` por `src/lib/analytics.ts` de
 * qualquer forma — quando a tag entrar, o histórico do funil já está lá.
 *
 * Preferência: GTM (um container gerencia GA4 + Pixel + o que vier). Se só
 * o GA4 estiver configurado, carrega o gtag direto.
 */
export function Analytics() {
  const { gtmId, ga4Id } = analyticsConfig;
  if (!gtmId && !ga4Id) return null;

  if (gtmId) {
    return (
      <Script id="gtm-loader" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
      </Script>
    );
  }

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />
      <Script id="ga4-loader" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');`}
      </Script>
    </>
  );
}
