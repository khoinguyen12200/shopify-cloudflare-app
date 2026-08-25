import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { data, redirect, useActionData, useLoaderData, useNavigation, Form } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useTranslation } from "react-i18next";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { SupportService } from "~/services/support.server";
import { SupportRepo } from "~/models/support.server";
import {
  createTicketSchema,
  readShopContact,
  CC_MAX,
  BODY_MAX,
  SUBJECT_MAX,
} from "~/schemas/support";
import { SUPPORT_CATEGORIES, CATEGORY_LABEL_KEY } from "~/support/categories";
import { supportErrorKey } from "~/support/error-keys";
import { AttachmentPicker, usePendingUploads } from "~/components/support/AttachmentPicker";

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

  const service = new SupportService();
  const created = await service.openTicket({
    shop: session.shop,
    shopName,
    merchantEmail: parsed.data.merchantEmail,
    ccEmails: parsed.data.ccEmails,
    category: parsed.data.category,
    subject: parsed.data.subject,
    body: parsed.data.body,
  });

  if (!created.ok) return data({ error: created.reason }, { status: 429 });

  // Attach whatever was streamed up while the form was being filled in. The
  // objects already exist in R2; this is the row that adopts them.
  const repo = new SupportRepo();
  const now = Date.now();
  for (const upload of parsed.data.uploadIds) {
    const meta = form.get(`upload:${upload}`);
    if (typeof meta !== "string") continue;
    const parts = meta.split("|");
    const [r2Key, filename, contentType, size] = parts;
    if (!r2Key || !filename || !contentType) continue;
    await repo.attach({
      shop: session.shop,
      messageId: created.value.messageId,
      id: upload,
      r2Key,
      filename,
      contentType,
      sizeBytes: Number(size ?? 0),
      at: now,
    });
  }

  return redirect(`/app/support/${created.value.id}?created=1`);
};

export default function NewTicket() {
  const { defaultEmail } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { t } = useTranslation(["admin", "common"]);
  const uploads = usePendingUploads();

  const busy = navigation.state !== "idle";
  const fieldErrors =
    actionData && "fieldErrors" in actionData ? actionData.fieldErrors : undefined;
  const error = actionData && "error" in actionData ? actionData.error : undefined;

  return (
    <Form method="post" encType="application/x-www-form-urlencoded">
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
              uploads={uploads}
              errorLabel={(reason) => t(supportErrorKey(reason))}
            />
          </s-stack>
        </s-section>

        <s-section heading={t("support.form.email")}>
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

            <s-text-area
              label={t("support.form.cc")}
              name="ccEmails"
              details={t("support.form.ccHelp", { max: CC_MAX })}
              rows={2}
              error={fieldErrors?.ccEmails}
            ></s-text-area>

            <s-button type="submit" variant="primary" loading={busy}>
              {busy ? t("support.form.submitting") : t("support.form.submit")}
            </s-button>
          </s-stack>
        </s-section>
      </s-page>
    </Form>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
