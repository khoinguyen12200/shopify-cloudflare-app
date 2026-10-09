import { Form } from "react-router";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from "ngk-dashboard";
import { formatDateTime } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
import type { Locale } from "~/i18n/config";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

const FIELD_CLASS =
  "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

interface PromoGrant {
  readonly id: string;
  readonly planHandle: string;
  readonly reason: string;
  readonly grantedBy: string;
  readonly startsAt: number;
  readonly expiresAt: number;
  readonly revokedAt: number | null;
}

interface PromoPlan {
  readonly handle: string;
  readonly name: string;
}

interface EffectivePlan {
  readonly planHandle: string;
  readonly source: string;
  readonly activePromo: {
    readonly planHandle: string;
    readonly remainingDays: number;
  } | null;
}

function EffectiveBadge({ effective }: { effective: EffectivePlan }) {
  if (effective.source === "promo") {
    return (
      <Badge variant="secondary" className="font-semibold">
        {`Promo Active: ${effective.planHandle.toUpperCase()} (${effective.activePromo?.remainingDays}d left)`}
      </Badge>
    );
  }
  if (effective.activePromo) {
    return (
      <Badge variant="outline">
        {`Paid Plan Active: ${effective.planHandle.toUpperCase()} (Promo ${effective.activePromo.planHandle.toUpperCase()} superseded)`}
      </Badge>
    );
  }
  return <Badge variant="outline">No Active Promo</Badge>;
}

function GrantPromoForm({ plans }: { plans: readonly PromoPlan[] }) {
  return (
    <Form method="post" className="flex flex-wrap items-end gap-3 pt-3 border-t">
      <input type="hidden" name="intent" value="grant_promo" />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="planHandle" className="text-xs font-medium text-muted-foreground">
          Promo Plan
        </label>
        <select id="planHandle" name="planHandle" className={FIELD_CLASS} required>
          {plans.map((p) => (
            <option key={p.handle} value={p.handle}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="durationDays" className="text-xs font-medium text-muted-foreground">
          Duration
        </label>
        <select id="durationDays" name="durationDays" className={FIELD_CLASS} defaultValue="10">
          <option value="3">3 Days</option>
          <option value="7">7 Days</option>
          <option value="10">10 Days</option>
          <option value="14">14 Days</option>
          <option value="30">30 Days</option>
          <option value="90">90 Days</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
        <label htmlFor="reason" className="text-xs font-medium text-muted-foreground">
          Reason / Justification
        </label>
        <input
          type="text"
          id="reason"
          name="reason"
          placeholder="e.g., VIP Demo, Retention goodwill, Extended trial"
          className={FIELD_CLASS}
          required
        />
      </div>

      <Button type="submit" size="sm" className="h-9">
        Grant Promo
      </Button>
    </Form>
  );
}

function GrantStatusBadge({ isActive, isRevoked }: { isActive: boolean; isRevoked: boolean }) {
  if (isActive) return <Badge variant="secondary" className="text-xs">Active</Badge>;
  if (isRevoked) return <Badge variant="destructive" className="text-xs">Revoked</Badge>;
  return <Badge variant="outline" className="text-xs">Expired</Badge>;
}

function RevokeForm({ grantId }: { grantId: string }) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="revoke_promo" />
      <input type="hidden" name="grantId" value={grantId} />
      <Button type="submit" variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive">
        Revoke
      </Button>
    </Form>
  );
}

function GrantRow({ grant, now }: { grant: PromoGrant; now: number }) {
  const isExpired = now >= grant.expiresAt;
  const isRevoked = grant.revokedAt !== null;
  const isActive = !isExpired && !isRevoked && now >= grant.startsAt;

  return (
    <TableRow>
      <TableCell className="font-medium">{grant.planHandle.toUpperCase()}</TableCell>
      <TableCell>
        <GrantStatusBadge isActive={isActive} isRevoked={isRevoked} />
      </TableCell>
      <TableCell className="max-w-xs truncate text-muted-foreground">{grant.reason}</TableCell>
      <TableCell className="text-muted-foreground">{grant.grantedBy}</TableCell>
      <TableCell className="text-muted-foreground">{formatDateTime(LOCALE, grant.expiresAt, UTC)}</TableCell>
      <TableCell className="text-right">
        {isActive && <RevokeForm grantId={grant.id} />}
      </TableCell>
    </TableRow>
  );
}

function GrantHistoryTable({ grants, now }: { grants: readonly PromoGrant[]; now: number }) {
  return (
    <div className="overflow-x-auto pt-2">
      <Table className="[&_th]:h-9 [&_th]:px-3 [&_td]:px-3 [&_td]:py-2 text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Granted By</TableHead>
            <TableHead>Valid Until</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grants.map((grant) => (
            <GrantRow key={grant.id} grant={grant} now={now} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function PromoOverridesCard({
  effective,
  canGrant,
  plans,
  grants,
  now,
}: {
  effective: EffectivePlan;
  canGrant: boolean;
  plans: readonly PromoPlan[];
  grants: readonly PromoGrant[];
  now: number;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <Text as="h2" className="text-base font-semibold">
                Promotional Plan Overrides
              </Text>
              <Text as="p" className="text-sm text-muted-foreground">
                Grant temporary comped plan access with auto-expiry. Organic higher-tier plans take precedence.
              </Text>
            </div>
            <div>
              <EffectiveBadge effective={effective} />
            </div>
          </div>

          {canGrant && <GrantPromoForm plans={plans} />}
          {grants.length > 0 && <GrantHistoryTable grants={grants} now={now} />}
        </div>
      </CardContent>
    </Card>
  );
}
