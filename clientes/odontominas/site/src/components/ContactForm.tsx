"use client";

import { useState } from "react";
import { getWhatsappLink } from "@/lib/config";
import { Button } from "./ui/Button";

/**
 * Formulário simples: sem API route, sem banco (conforme contexto.md do
 * projeto). No submit monta a mensagem e abre o WhatsApp com o texto
 * pré-preenchido — getWhatsappLink() é o único ponto de montagem do link.
 */
export function ContactForm() {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const texto = [
      `Olá! Meu nome é ${nome || "..."}.`,
      telefone ? `Meu telefone: ${telefone}.` : "",
      mensagem || "Gostaria de agendar uma avaliação na OdontoMinas.",
    ]
      .filter(Boolean)
      .join(" ");
    window.open(getWhatsappLink("contato", texto), "_blank", "noopener,noreferrer");
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 text-left">
      <label className="grid gap-1.5 text-sm">
        Nome
        <input
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--color-surface-1)] px-4 py-2.5 text-[var(--color-text)] outline-none focus-visible:border-[var(--color-cyan)]"
        />
      </label>
      <label className="grid gap-1.5 text-sm">
        Telefone
        <input
          required
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--color-surface-1)] px-4 py-2.5 text-[var(--color-text)] outline-none focus-visible:border-[var(--color-cyan)]"
        />
      </label>
      <label className="grid gap-1.5 text-sm">
        Mensagem
        <textarea
          rows={4}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Gostaria de agendar uma avaliação..."
          className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--color-surface-1)] px-4 py-2.5 text-[var(--color-text)] outline-none focus-visible:border-[var(--color-cyan)]"
        />
      </label>
      <Button type="submit" className="justify-self-start">
        Enviar pelo WhatsApp
      </Button>
    </form>
  );
}
