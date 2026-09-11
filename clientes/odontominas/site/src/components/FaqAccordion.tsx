"use client";

import { useState } from "react";
import { FaqItem } from "@/content/faq";
import { Icon } from "./ui/Icon";

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="grid gap-2.5">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={item.pergunta}
            className={`rounded-[var(--radius-md)] border transition-colors duration-200 ${
              isOpen
                ? "border-[var(--hairline-strong)] bg-[var(--color-surface-2)]"
                : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]"
            }`}
          >
            <button
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              aria-expanded={isOpen}
            >
              <span className="font-medium tracking-tight">{item.pergunta}</span>
              <Icon
                name="chevron"
                size={16}
                className="shrink-0 text-[var(--color-text-dim)] transition-transform duration-300"
                style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
              />
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 pr-10 text-sm text-[var(--color-text-muted)]">{item.resposta}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
