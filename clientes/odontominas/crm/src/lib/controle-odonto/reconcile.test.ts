import { describe, expect, it } from "vitest";
import { diffAppointments } from "./reconcile";
import type { ExternalAppointmentDTO } from "./types";

function remoto(overrides: Partial<ExternalAppointmentDTO>): ExternalAppointmentDTO {
  return {
    externalId: "ext-1",
    establishmentExternalId: null,
    professionalExternalId: null,
    patientExternalId: null,
    patientPhone: null,
    startAt: null,
    endAt: null,
    status: "agendado",
    rawStatus: "agendado",
    ...overrides,
  };
}

describe("diffAppointments", () => {
  it("agendamento remoto sem correspondente local vira faltando_localmente", () => {
    const r = diffAppointments([], [remoto({ externalId: "a1" })]);
    expect(r).toEqual([{ externalId: "a1", tipo: "faltando_localmente", detalhe: expect.any(String) }]);
  });

  it("cancelado remotamente mas ainda não cancelado localmente vira cancelado_externamente", () => {
    const r = diffAppointments([{ externalId: "a1", status: "agendado", dataHora: null }], [remoto({ externalId: "a1", status: "cancelado" })]);
    expect(r).toEqual([{ externalId: "a1", tipo: "cancelado_externamente", detalhe: "local: agendado" }]);
  });

  it("status diferente sem ser cancelamento vira divergente", () => {
    const r = diffAppointments(
      [{ externalId: "a1", status: "agendado", dataHora: null }],
      [remoto({ externalId: "a1", status: "confirmado" })]
    );
    expect(r).toEqual([{ externalId: "a1", tipo: "divergente", detalhe: "local: agendado, remoto: confirmado" }]);
  });

  it("tudo igual não gera divergência nenhuma — nunca apaga/altera nada sozinho", () => {
    const r = diffAppointments([{ externalId: "a1", status: "agendado", dataHora: null }], [remoto({ externalId: "a1", status: "agendado" })]);
    expect(r).toEqual([]);
  });
});
