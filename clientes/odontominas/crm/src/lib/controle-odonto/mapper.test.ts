import { describe, expect, it } from "vitest";
import { mapControleOdontoAppointmentStatus } from "./mapper";

describe("mapControleOdontoAppointmentStatus", () => {
  it("null/undefined/vazio vira unknown_external_status", () => {
    expect(mapControleOdontoAppointmentStatus(null)).toBe("unknown_external_status");
    expect(mapControleOdontoAppointmentStatus(undefined)).toBe("unknown_external_status");
    expect(mapControleOdontoAppointmentStatus("")).toBe("unknown_external_status");
  });

  it("qualquer status bruto vira unknown_external_status hoje — nenhum valor real foi confirmado ainda", () => {
    expect(mapControleOdontoAppointmentStatus("AGENDADO")).toBe("unknown_external_status");
    expect(mapControleOdontoAppointmentStatus("cancelled")).toBe("unknown_external_status");
    expect(mapControleOdontoAppointmentStatus("qualquer-coisa-inesperada")).toBe("unknown_external_status");
  });

  it("nunca lança, mesmo com entrada estranha", () => {
    expect(() => mapControleOdontoAppointmentStatus("   ")).not.toThrow();
  });
});
