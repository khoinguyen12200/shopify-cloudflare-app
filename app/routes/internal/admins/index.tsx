import { data, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Admins · Staff Console" },
];
import { useState } from "react";
import { BlockStack, Page } from "ngk-dashboard";
import { requireOwner } from "~/services/admin-auth.server";
import { adminUsers } from "~/wiring.server";
// Type-only: erased at build, so it does not pull the server module into the
// client bundle.
import type { AdminErrorReason } from "~/services/admin-management.server";
import type { SafeAdminUser } from "~/db/schema";
import { INTENTS, SUCCESS_KEY, readIntent, type Intent } from "./intents.server";
import { AdminAlerts, useAdminFeedback } from "./feedback";
import { Deferred, TableSkeleton } from "~/internal/components";
import { streamRegion } from "~/internal/stream-region.server";
import { AdminsTable } from "./table";
import { AddAdminCard } from "./add-form";
import { RemoveAdminDialog } from "./remove-dialog";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Owner-only. requireOwner throws 403 for a signed-in non-owner, which the
  // layout's ErrorBoundary renders.
  const actor = await requireOwner(request, { users: adminUsers() });
  const url = new URL(request.url);
  return {
    actor,
    // Streamed: the owner check above is all the page frame waits on.
    admins: streamRegion("admins", "list", adminUsers().list()),
    // Set by reset.tsx's redirect after a password reset — that page has
    // nothing of its own to render success on, since it navigates away.
    resetSuccess: url.searchParams.get("reset") === "1",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const actor = await requireOwner(request, { users: adminUsers() });
  const form = await request.formData();
  const intent = readIntent(form);

  // Unknown intent: a bad request, not a crash.
  if (!intent) {
    const notFound: AdminErrorReason = "notFound";
    return data({ error: notFound }, { status: 400 });
  }

  const handler = INTENTS[intent];

  const result = await handler(form, actor.id);
  if (!result.ok) return data({ error: result.reason }, { status: 400 });

  return data({
    success: SUCCESS_KEY[intent],
    name: result.value?.name ?? "",
    role: result.value?.role ?? "",
  });
};

export default function Admins() {
  const { actor, admins, resetSuccess } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const busy = navigation.state !== "idle";
  // Which single control is the one actually submitting, so only ITS button
  // spins — not every button on the page.
  const pendingIntent = navigation.formData?.get("intent");
  const pendingId = navigation.formData?.get("id");
  const isPending = (intent: Intent, id?: string) =>
    busy && pendingIntent === intent && (id === undefined || pendingId === id);

  const feedback = useAdminFeedback(actionData, resetSuccess);

  // One dialog for the whole table rather than one per row: only ever a single
  // pending confirmation, so a single piece of state describes it.
  const [confirming, setConfirming] = useState<SafeAdminUser | null>(null);

  return (
    <Page title="Admins" subtitle="Who can sign in to this console" fullWidth>
      <BlockStack gap={4}>
        <AdminAlerts feedback={feedback} resetSuccess={resetSuccess} />
        <Deferred resolve={admins} fallback={<TableSkeleton rows={4} columns={6} />} errorTitle="The admins list">
          {(resolved) => (
            <AdminsTable
              admins={resolved}
              actorId={actor.id}
              busy={busy}
              isPending={isPending}
              onRemove={setConfirming}
            />
          )}
        </Deferred>
        <AddAdminCard busy={busy} loading={isPending("create")} />
        <RemoveAdminDialog
          confirming={confirming}
          busy={busy}
          onClose={() => setConfirming(null)}
        />
      </BlockStack>
    </Page>
  );
}
