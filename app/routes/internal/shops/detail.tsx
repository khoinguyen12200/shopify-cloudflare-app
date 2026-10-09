import { shops, adminSessionUsers, adminUsers } from "~/wiring.server";
import { useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { CardSkeleton, EmptyState, Page } from "ngk-dashboard";
import { Store } from "lucide-react";
import { requireAdminUser } from "~/services/admin-auth.server";
import { setShopDevStatus, grantShopPromoPlan, revokeShopPromoPlan } from "~/services/internal-admin/ops.server";
import { Deferred, TableSkeleton } from "~/internal/components";
import { streamRegion } from "~/internal/stream-region.server";
import { loadShopDetail } from "./detail-data.server";
import { EventHistorySection, SubscriptionHistoryCard } from "./detail-history";
import { PromoOverridesCard } from "./detail-promo";
import { ReconciliationFailureCard, ShopSummaryCard } from "./detail-summary";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `${data?.shopDomain ?? "Shop"} · Staff Console` },
];

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireAdminUser(request, { users: adminSessionUsers() });
  const shopDomain = decodeURIComponent(params.shop ?? "");

  // Only auth is awaited: the frame (titled from the URL) paints at once and the
  // shop's data streams in. A missing shop resolves to `null`, rendered as a
  // not-found state in the region.
  return { shopDomain, detail: streamRegion("shop_detail", "detail", loadShopDetail(shopDomain)) };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const user = await requireAdminUser(request, { users: adminUsers() });
  const shopDomain = decodeURIComponent(params.shop ?? "");
  const shop = await shops().get(shopDomain);
  if (!shop) throw new Response("Not found", { status: 404 });

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  if (intent === "toggle_dev_status") {
    await setShopDevStatus(shopDomain, !shop.isDevStore);
  } else if (intent === "grant_promo") {
    await grantShopPromoPlan(shopDomain, {
      planHandle: String(form.get("planHandle") ?? ""),
      durationDays: Number(form.get("durationDays") ?? 7),
      reason: String(form.get("reason") ?? ""),
      grantedBy: user.email,
    });
  } else if (intent === "revoke_promo") {
    const grantId = String(form.get("grantId") ?? "");
    await revokeShopPromoPlan(shopDomain, grantId, user.email);
  }

  return null;
};

export default function ShopDetail() {
  const { shopDomain, detail } = useLoaderData<typeof loader>();

  return (
    <Page
      title={shopDomain}
      subtitle="Install history and subscription activity."
      backAction={{ label: "Shops", href: "/internal/shops" }}
      fullWidth
    >
      <Deferred resolve={detail} resetKey={shopDomain} fallback={<DetailSkeleton />} errorTitle="This shop">
        {(loaded) => (loaded ? <ShopDetailBody {...loaded} /> : <ShopNotFound shopDomain={shopDomain} />)}
      </Deferred>
    </Page>
  );
}

type LoadedShop = NonNullable<Awaited<ReturnType<typeof loadShopDetail>>>;

function ShopDetailBody({
  shop,
  history,
  events,
  reconciliation,
  promoStatus,
  effective,
  promoAvailablePlans,
  now,
}: LoadedShop) {
  return (
    <div className="flex flex-col gap-4">
      {reconciliation?.lastFailedAt && (
        <ReconciliationFailureCard
          failureDetail={reconciliation.failureDetail}
          failureCode={reconciliation.failureCode}
        />
      )}
      <ShopSummaryCard shop={shop} />
      <PromoOverridesCard
        effective={effective}
        canGrant={shop.uninstalledAt === null}
        plans={promoAvailablePlans}
        grants={promoStatus.history}
        now={now}
      />
      <EventHistorySection events={events} />
      <SubscriptionHistoryCard history={history} />
    </div>
  );
}

function ShopNotFound({ shopDomain }: { shopDomain: string }) {
  return (
    <EmptyState heading="Shop not found" icon={Store}>
      {shopDomain} has never installed this app.
    </EmptyState>
  );
}

/** Mirrors the body: summary strip, promo card, then two history tables. */
function DetailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <CardSkeleton lines={2} header={false} />
      <CardSkeleton lines={3} />
      <TableSkeleton rows={4} columns={4} />
      <TableSkeleton rows={3} columns={4} />
    </div>
  );
}
