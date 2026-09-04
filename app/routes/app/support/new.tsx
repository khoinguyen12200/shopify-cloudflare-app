import { support } from "~/wiring.server";
import { useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { data, redirect, useActionData, useLoaderData, Form } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useTranslation } from "react-i18next";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { getLocale } from "~/i18n/i18n.server";
import { supportService } from "~/wiring.server";
import {
  createTicketSchema,
  readShopContact,
  BODY_MAX,
  SUBJECT_MAX,
} from "~/schemas/support";
import { CC_MAX } from "~/support/cc-list";
import { SUPPORT_CATEGORIES, CATEGORY_LABEL_KEY } from "~/support/categories";
import { supportErrorKey } from "~/support/error-keys";
import { useActionToast } from "~/admin/use-action-toast";
import { CcEmails, ccLabels } from "~/components/support/CcEmails";
import { AttachmentPicker } from "~/components/support/AttachmentPicker";
import { usePendingUploads } from "./use-pending-uploads";

export const handle = { i18n: ["common", "admin"] };

/**
 * The shop's own contact details, so the merchant never types their own email.
 * `email` is the account owner's address — the person who installed the app and
 * the one who should receive replies. Validated against the 2026-10 schema.
 */
const SHOP_CONTACT_QUERY = `#graphql
  query SupportShopContact {
    shop {
      name
      email
      contactEmail
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await createShopify(getEnv()).authenticate.admin(request);

  const response = await admin.graphql(SHOP_CONTACT_QUERY);
  const contact = readShopContact(await response.json());

  return { shopName: contact.name, defaultEmail: contact.email };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await createShopify(getEnv()).authenticate.admin(request);
  const form = await request.formData();

  const parsed = createTicketSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    // Field-level messages, so the form can point at what is wrong rather than
    // showing one banner for everything.
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return data({ fieldErrors }, { status: 400 });
  }

  // The shop name is a snapshot on the ticket, so it is read here rather than
  // trusted from the form — a hidden field is merchant-editable.
  const contact = await admin.graphql(SHOP_CONTACT_QUERY);
  const shopName = readShopContact(await contact.json()).name || session.shop;

  const service = supportService();
  const created = await service.openTicket({
    shop: session.shop,
    shopName,
    // Shopify puts the merchant's chosen admin language on every embedded
    // request, and this is the only moment we have it: staff answer later from
    // the internal console, which knows nothing about them (@rules/i18n.md).
    locale: await getLocale(request),
    merchantEmail: parsed.data.merchantEmail,
    ccEmails: parsed.data.ccEmails,
    category: parsed.data.category,
    subject: parsed.data.subject,
    body: parsed.data.body,
  });

  if (!created.ok) return data({ error: created.reason }, { status: 429 });

  // Attach whatever was streamed up while the form was being filled in. The
  // objects already exist in R2; this is the row that adopts them.
  const adopted = await support().adoptPendingUploads(
    session.shop, created.value.messageId, parsed.data.uploadIds, Date.now(),
  );
  if (!adopted) return data({ error: "invalid_upload" as const }, { status: 400 });

  // `?created=1` is what makes the thread page toast on arrival. The
  // confirmation belongs on the screen the merchant lands on, not on this one,
  // which is already gone by then.
  return redirect(`/app/support/${created.value.id}?created=1`);
};

export default function NewTicket() {
  const { defaultEmail } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { t } = useTranslation(["admin", "common"]);
  const uploads = usePendingUploads();
  const [ccEmails, setCcEmails] = useState<string[]>([]);

  const fieldErrors =
    actionData && "fieldErrors" in actionData ? actionData.fieldErrors : undefined;
  const error = actionData && "error" in actionData ? actionData.error : undefined;

  // Success is reported by the thread page we redirect to, so only failure is
  // announced here. The inline banner below stays the authoritative report.
  useActionToast(actionData, error ? { error: t(supportErrorKey(error)) } : undefined);

  return (
    /*
     * `data-save-bar` hands saving to the admin's own save bar at the top of
     * the frame, which is where every other screen in every Shopify app puts
     * it. That is also why there is no Send button at the bottom of this form:
     * two save controls on one screen is two competing conventions, and the
     * one the merchant already knows wins.
     *
     * The bar owns the pending state of its own Save button, which is why this
     * page no longer tracks `navigation.state` for one.
     *
     * `data-discard-confirmation` because Discard throws away a written bug
     * report and any files already uploaded — not something to lose to a
     * mis-click.
     */
    <Form
      method="post"
      data-save-bar
      data-discard-confirmation
      onReset={() => {
        // A native reset restores the DOM inputs to their defaults, but the CC
        // list and the staged files live in React state and in R2, so Discard
        // has to be told about them explicitly.
        setCcEmails([]);
        uploads.reset();
      }}
    >
      <s-page heading={t("support.newTicket")}>
        <s-link slot="breadcrumb-actions" href="/app/support">
          {t("support.heading")}
        </s-link>

        {error && (
          <s-section>
            <s-banner tone="critical" heading={t(supportErrorKey(error))}></s-banner>
          </s-section>
        )}

        <s-section heading={t("support.form.heading")}>
          <s-stack direction="block" gap="base">
            <s-select
              label={t("support.form.category")}
              name="category"
              value="bug"
              error={fieldErrors?.category}
            >
              {SUPPORT_CATEGORIES.map((category) => (
                <s-option key={category} value={category}>
                  {t(CATEGORY_LABEL_KEY[category])}
                </s-option>
              ))}
            </s-select>

            <s-text-field
              label={t("support.form.subject")}
              name="subject"
              placeholder={t("support.form.subjectPlaceholder")}
              maxLength={SUBJECT_MAX}
              error={fieldErrors?.subject}
              required
            ></s-text-field>

            <s-text-area
              label={t("support.form.body")}
              name="body"
              details={t("support.form.bodyHelp")}
              rows={6}
              maxLength={BODY_MAX}
              error={fieldErrors?.body}
              required
            ></s-text-area>

            <AttachmentPicker
              label={t("support.form.attachments")}
              addLabel={t("support.form.addFiles")}
              limitsLabel={t("support.form.attachmentLimits")}
              uploads={uploads}
              errorLabel={(reason) => t(supportErrorKey(reason))}
            />
          </s-stack>
        </s-section>

        <s-section heading={t("support.form.emailHeading")}>
          <s-stack direction="block" gap="base">
            {/* Prefilled from Shopify — the merchant should never have to type
                their own address to get a reply. Clearable, because some
                merchants only want the in-app thread. */}
            <s-email-field
              label={t("support.form.email")}
              name="merchantEmail"
              value={defaultEmail}
              details={t("support.form.emailHelp")}
              error={fieldErrors?.merchantEmail}
            ></s-email-field>

            <s-divider direction="block" />

            <CcEmails
              id="new-ticket-cc"
              name="ccEmails"
              emails={ccEmails}
              onChange={setCcEmails}
              labels={ccLabels(t, CC_MAX)}
            />
          </s-stack>
        </s-section>
      </s-page>
    </Form>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
