import { describe, expect, it } from "vitest";
import { cookieInvite, lireCodeSalon, refusPseudoInvite } from "@/lib/multi/salon";

describe("invités des salons (#134)", () => {
  it("lit le code de partie comme le serveur", () => {
    expect(lireCodeSalon("14/07/1789")).toBe("14/07/1789");
    expect(lireCodeSalon(" 4.7.1789 ")).toBe("04/07/1789");
    expect(lireCodeSalon("17 - 03 - 1642")).toBe("17/03/1642");
    expect(lireCodeSalon("31/02/1789")).toBeNull();
    expect(lireCodeSalon("1789")).toBeNull();
  });

  it("prévient des pseudos refusés avant l'envoi", () => {
    expect(refusPseudoInvite("  Clément   B ")).toBeNull();
    expect(refusPseudoInvite("Al")).not.toBeNull();
    expect(refusPseudoInvite("Abcdefghijklmnopq")).not.toBeNull();
    expect(refusPseudoInvite("<script>")).not.toBeNull();
  });

  it("n'accepte qu'un identifiant de salon pour nommer le cookie", () => {
    expect(cookieInvite("8F14E45F-CEEA-467F-A0E6-96E6F2B8C1A2")).toBe("histoire-salon-8f14e45f-ceea-467f-a0e6-96e6f2b8c1a2");
    expect(() => cookieInvite("../autre")).toThrow();
  });
});
