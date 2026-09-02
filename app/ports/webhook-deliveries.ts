export interface WebhookDeliveryInput {
  readonly id: string;
  readonly eventId: string;
  readonly topic: string;
  readonly apiVersion: string;
  readonly shop: string;
  readonly triggeredAt: number;
  readonly receivedAt: number;
  readonly payloadHash: string;
}

export interface WebhookDeliveriesPort {
  claim(input: WebhookDeliveryInput): Promise<"claimed" | "duplicate">;
  get(shop: string, id: string): Promise<{ readonly status: string } | undefined>;
  markQueued(shop: string, id: string): Promise<void>;
}
