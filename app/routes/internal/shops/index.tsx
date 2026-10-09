import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Shops · Staff Console" },
];
import { EmptyState, Page } from "ngk-dashboard";
import { Store } from "lucide-react";
import { requireAdminUser } from "~/services/admin-auth.server";
import { adminSessionUsers } from "~/wiring.server";
import { listShopsDirectory } from "~/services/internal-admin/ops.server";
import { Deferred, TableSkeleton } from "~/internal/components";
import { streamRegion } from "~/internal/stream-region.server";
import { ShopsTable } from "./table";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdminUser(request, { users: adminSessionUsers() });

  const shops = listShopsDirectory({ limit: 1_000 }).then((directory) =>
    directory.map((shop) => ({
      shop: shop.shop,
      name: shop.name,
      email: shop.contactEmail || shop.email,
      logoUrl: shop.logoUrl || `https://${shop.shop}/favicon.ico`,
      installedAt: shop.installedAt,
      active: shop.uninstalledAt === null,
      isDevStore: shop.isDevStore,
      planName: shop.planName,
    })),
  );

  return { shops: streamRegion("shops", "directory", shops) };
};

export default function Shops() {
  const { shops } = useLoaderData<typeof loader>();

  return (
    <Page title="Shops" subtitle="Every shop that has ever installed this app." fullWidth>
      <Deferred resolve={shops} fallback={<TableSkeleton rows={10} columns={5} />} errorTitle="The shops list">
        {(resolved) =>
          resolved.length === 0 ? (
            <EmptyState heading="No shops yet" icon={Store}>
              The first install writes a row here.
            </EmptyState>
          ) : (
            <ShopsTable shops={resolved} />
          )
        }
      </Deferred>
    </Page>
  );
}
