import { beforeEach, describe, expect, it, vi } from "vitest";

const attempts = vi.hoisted(() => [] as { ipHash: string; createdAt: Date }[]);

vi.mock("@/lib/prisma", () => {
  const matches =
    (where: { ipHash?: string; createdAt?: { gte?: Date; lt?: Date } }) =>
    (a: { ipHash: string; createdAt: Date }) =>
      (where.ipHash === undefined || a.ipHash === where.ipHash) &&
      (where.createdAt?.gte === undefined || a.createdAt >= where.createdAt.gte) &&
      (where.createdAt?.lt === undefined || a.createdAt < where.createdAt.lt);
  return {
    prisma: {
      loginAttempt: {
        count: async ({ where }: { where: Parameters<typeof matches>[0] }) =>
          attempts.filter(matches(where)).length,
        create: async ({ data }: { data: { ipHash: string } }) => {
          attempts.push({ ipHash: data.ipHash, createdAt: new Date() });
        },
        deleteMany: async ({ where }: { where: Parameters<typeof matches>[0] }) => {
          const keep = attempts.filter((a) => !matches(where)(a));
          attempts.length = 0;
          attempts.push(...keep);
        },
      },
    },
  };
});

import { checkAdminPassword } from "@/lib/adminLogin";

describe("checkAdminPassword", () => {
  beforeEach(() => {
    attempts.length = 0;
    vi.stubEnv("SESSION_SECRET", "test-secret");
    vi.stubEnv("ADMIN_PASSWORD", "richtig");
  });

  it("lässt das richtige Passwort durch und ein falsches nicht", async () => {
    expect(await checkAdminPassword("falsch", "1.1.1.1")).toBe("invalid");
    expect(await checkAdminPassword("richtig", "1.1.1.1")).toBe("ok");
  });

  it("lässt ohne gesetztes Passwort niemanden hinein, auch nicht mit leerer Eingabe", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    await expect(checkAdminPassword("", "1.1.1.1")).rejects.toThrow("ADMIN_PASSWORD");
  });

  it("sperrt eine IP nach fünf Fehlversuchen, auch für das richtige Passwort", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await checkAdminPassword("falsch", "1.1.1.1")).toBe("invalid");
    }
    expect(await checkAdminPassword("richtig", "1.1.1.1")).toBe("rate_limited");
    expect(attempts).toHaveLength(5);
  });

  it("sperrt andere IPs wegen einer einzelnen nicht", async () => {
    for (let i = 0; i < 6; i++) await checkAdminPassword("falsch", "1.1.1.1");
    expect(await checkAdminPassword("richtig", "2.2.2.2")).toBe("ok");
  });

  it("sperrt alle nach 20 Fehlversuchen von verschiedenen Adressen", async () => {
    for (let i = 0; i < 20; i++) await checkAdminPassword("falsch", `10.0.0.${i}`);
    expect(await checkAdminPassword("richtig", "2.2.2.2")).toBe("rate_limited");
  });

  it("vergisst Vertipper nach einem erfolgreichen Login", async () => {
    for (let i = 0; i < 4; i++) await checkAdminPassword("falsch", "1.1.1.1");
    expect(await checkAdminPassword("richtig", "1.1.1.1")).toBe("ok");
    expect(attempts).toHaveLength(0);
  });
});
