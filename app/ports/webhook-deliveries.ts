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

export interface StoredWebhookDelivery {
  readonly status: string;
  readonly id?: string;
  readonly shop?: string;
  readonly topic?: string;
  readonly processingStartedAt?: number | null;
  readonly failureCode?: string | null;
}

export interface WebhookDeliveriesPort {
  claim(input: WebhookDeliveryInput): Promise<"claimed" | "duplicate">;
  get(shop: string, id: string): Promise<StoredWebhookDelivery | undefined>;
  markQueued(shop: string, id: string): Promise<void>;
}
