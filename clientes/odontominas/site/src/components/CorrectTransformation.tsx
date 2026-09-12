"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";

/**
 * Simulação visual educativa do Protocolo Correct Full Arch — NUNCA um
 * antes/depois de paciente real (ver clientes/odontominas/contexto.md).
 * É um diagrama conceitual de arco dentário: linhas e formas, sem pretensão
 * de fotografia ou anatomia realista — a escolha deliberada evita o risco de
 * uma ilustração "semi-realista" malfeita (que o briefing pede pra nunca
 * deixar grotesca). Compara "condição inicial" com "após reabilitação" só
 * com essas legendas — nunca "antes/depois", que sugeriria resultado clínico.
 *
 * Duas variantes:
 * - "interactive" (hero): loop automático sutil + slider pro usuário comparar.
 * - "ambient" (seção Protocolo Correct): só o loop, decorativo, sem slider.
 */

type Point = { x: number; y: number };

function bezier(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const mt = 1 - t;
  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
  };
}

const ARCH_P0: Point = { x: 26, y: 66 };
const ARCH_P1: Point = { x: 100, y: 172 };
const ARCH_P2: Point = { x: 220, y: 172 };
const ARCH_P3: Point = { x: 294, y: 66 };

const TOOTH_COUNT = 11;
const TEETH: Point[] = Array.from({ length: TOOTH_COUNT }, (_, i) => {
  const t = 0.09 + (i / (TOOTH_COUNT - 1)) * 0.82;
  return bezier(t, ARCH_P0, ARCH_P1, ARCH_P2, ARCH_P3);
});

/** Vãos na condição inicial + um dente com desgaste visível — irregular, nunca grotesco. */
const GAPS_INICIAL = new Set([3, 7]);
const IRREGULAR_INICIAL = new Set([5]);

/** Fases do loop automático: 0–2.5s parado, 2.5–4s transição, 4–7s parado, 7–8.5s retorno, repete. */
const CYCLE_MS = 8500;
function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
}
function autoT(elapsedMs: number): number {
  const m = elapsedMs % CYCLE_MS;
  if (m < 2500) return 0;
  if (m < 4000) return easeInOut((m - 2500) / 1500);
  if (m < 7000) return 1;
  if (m < 8500) return 1 - easeInOut((m - 7000) / 1500);
  return 0;
}

type Props = {
  variant?: "interactive" | "ambient";
  /** desliga a etiqueta interna quando a seção já tem seu próprio overline ao lado. */
  showLabel?: boolean;
  className?: string;
};

export function CorrectTransformation({ variant = "interactive", showLabel = true, className = "" }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const [manual, setManual] = useState(false);
  const [t, setT] = useState(0);

  useEffect(() => {
    if (manual) return; // usuário está no controle — o loop nunca mais sobrescreve.
    if (reducedMotion) {
      setT(1);
      return;
    }
    let start: number | null = null;
    const id = window.setInterval(() => {
      if (start === null) start = Date.now();
      setT(autoT(Date.now() - start));
    }, 60);
    return () => window.clearInterval(id);
  }, [manual, reducedMotion]);

  const opacidadeInicial = 1 - t;
  const opacidadeReabilitado = t;

  return (
    <div className={`correct-visual p-6 sm:p-8 ${className}`}>
      {showLabel && <span className="t-label text-[var(--color-teal-900)]">Protocolo Correct</span>}

      <svg
        viewBox="0 0 320 200"
        className={showLabel ? "mt-4 w-full" : "w-full"}
        role="img"
        aria-label="Ilustração conceitual comparando a condição inicial do arco dentário com a situação após a reabilitação sobre implantes."
      >
        <path
          d={`M ${ARCH_P0.x} ${ARCH_P0.y} C ${ARCH_P1.x} ${ARCH_P1.y}, ${ARCH_P2.x} ${ARCH_P2.y}, ${ARCH_P3.x} ${ARCH_P3.y}`}
          fill="none"
          stroke="var(--hairline-strong)"
          strokeWidth={1}
          strokeDasharray="2 6"
          strokeLinecap="round"
        />

        <g style={{ opacity: opacidadeInicial }}>
          {TEETH.map((p, i) => {
            if (GAPS_INICIAL.has(i)) return null;
            const irregular = IRREGULAR_INICIAL.has(i);
            const w = irregular ? 12 : 16;
            const h = irregular ? 16 : 24;
            return (
              <rect
                key={i}
                x={p.x - w / 2}
                y={p.y - h / 2 + (irregular ? 4 : 0)}
                width={w}
                height={h}
                rx={5}
                fill="none"
                stroke="var(--color-text-dim)"
                strokeWidth={1.4}
              />
            );
          })}
        </g>

        <g style={{ opacity: opacidadeReabilitado }}>
          {TEETH.map((p, i) => (
            <rect
              key={i}
              x={p.x - 8}
              y={p.y - 12}
              width={16}
              height={24}
              rx={6}
              fill="var(--color-tooth)"
              stroke="var(--color-cyan)"
              strokeWidth={1.2}
            />
          ))}
        </g>
      </svg>

      <div className="mt-5 flex items-center justify-between t-label">
        <span className={opacidadeInicial > 0.5 ? "text-[var(--color-text)]" : "text-[var(--color-text-dim)]"}>
          Condição inicial
        </span>
        <span className={opacidadeReabilitado > 0.5 ? "text-[var(--color-text)]" : "text-[var(--color-text-dim)]"}>
          Após reabilitação
        </span>
      </div>

      {variant === "interactive" && (
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(t * 100)}
          onChange={(e) => {
            setManual(true);
            setT(Number(e.target.value) / 100);
          }}
          className="compare-slider mt-3"
          aria-label="Comparar condição inicial e situação após a reabilitação"
        />
      )}

      <p className="mt-4 text-xs text-[var(--color-text-dim)]">
        Simulação ilustrativa. Cada caso exige avaliação individual.
      </p>
    </div>
  );
}
