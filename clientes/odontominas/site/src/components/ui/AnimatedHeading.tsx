"use client";

import { CSSProperties, ElementType, Fragment } from "react";
import { useInView } from "@/lib/hooks";

/**
 * Headline com revelação por linha (masked line reveal, §29). As quebras
 * são intencionais — passadas como array. Um trecho pode receber tratamento
 * de acento (gradiente ciano→verde) via `accent`.
 */
type Props = {
  lines: string[];
  accent?: string;
  as?: ElementType;
  className?: string;
  id?: string;
};

export function AnimatedHeading({ lines, accent, as: Tag = "h2", className = "", id }: Props) {
  const [ref, inView] = useInView<HTMLHeadingElement>();

  const renderLine = (line: string) => {
    if (!accent || !line.includes(accent)) return line;
    const [before, after] = line.split(accent);
    return (
      <>
        {before}
        <span className="accent-gradient">{accent}</span>
        {after}
      </>
    );
  };

  return (
    <Tag ref={ref} id={id} className={className}>
      {lines.map((line, i) => (
        <Fragment key={line}>
          <span className="block overflow-hidden pb-[0.06em]">
            <span
              data-anim="slide-reveal"
              style={{ "--anim-delay": `${i * 80}ms` } as CSSProperties}
              className={`block ${inView ? "is-in" : ""}`}
            >
              {renderLine(line)}
            </span>
          </span>
        </Fragment>
      ))}
    </Tag>
  );
}
