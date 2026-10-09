import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConsumerDelivery } from "~/services/webhook-consumer";
import type { RecordUninstallPorts } from "~/services/record-uninstall";
import { appUninstalledHandler } from "./app-uninstalled";

afterEach(() => vi.restoreAllMocks());

describe("appUninstalledHandler", () => {
  it("dates the uninstall by the delivery's trigger time and keys it by the delivery id", async () => {
    const written: unknown[] = [];
    const ports: RecordUninstallPorts = {
      shops: {
        facts: async () => ({ relationshipStatus: "INSTALLED", relationshipOccurredAt: 10, relationshipExternalId: "i", installedAt: 10, currentInstalledAt: 10, uninstalledAt: null }),
        applyUninstall: async (_shop, next) => { written.push(next); return "applied"; },
      },
      cleanup: async () => undefined,
      reconcile: async () => ({ ok: true }),
    };
    const delivery: ConsumerDelivery = { id: "wh-9", shop: "fake.myshopify.com", topic: "app/uninstalled", status: "processing", triggeredAt: 777 };
    await appUninstalledHandler(ports)(delivery);
    expect(written).toEqual([{ kind: "uninstalled", occurredAt: 777, externalId: "webhook:wh-9" }]);
  });
});
