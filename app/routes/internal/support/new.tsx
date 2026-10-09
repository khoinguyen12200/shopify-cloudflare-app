import { useState } from "react";
import { Form, data, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "New Support Ticket · Staff Console" },
];
import {
  Alert,
  AlertDescription,
  Badge,
  BlockStack,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
  Page,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
  Textarea,
} from "ngk-dashboard";
import {
  Info,
  Mail,
  Send,
  Sparkles,
  Store,
} from "lucide-react";
import { requireAdminUser } from "~/services/admin-auth.server";
import { adminUsers, shopMetrics, support, adminSessionUsers } from "~/wiring.server";
import { CATEGORY_LABEL_EN, SUPPORT_CATEGORIES, toSupportCategory, type SupportCategory } from "~/support/categories";
import { BODY_MAX, SUBJECT_MAX } from "~/schemas/support";
import { usePendingUploads } from "~/routes/app/support/use-pending-uploads";
import { InternalAttachmentPicker } from "~/components/support/InternalAttachmentPicker";
import { useReplyDraft } from "~/internal/use-reply-draft";
import { DEFAULT_TONE, REPLY_TONES, TONE_LABEL, toReplyTone, type ReplyTone } from "~/ai/tones";
import { createTicketOnBehalf } from "~/services/internal-admin/ops.server";

export interface ShopContactInfo {
  readonly shop: string;
  readonly isDevStore: boolean;
  readonly shopName: string;
  readonly merchantEmail: string | null;
  readonly logoUrl: string | null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const actor = await requireAdminUser(request, { users: adminSessionUsers() });
  const [allShops, knownContacts] = await Promise.all([
    shopMetrics().contacts(),
    support().listKnownContacts(),
  ]);

  const shopsWithContacts: ShopContactInfo[] = allShops
    .map((s) => ({
      shop: s.shop,
      isDevStore: s.isDevStore,
      shopName: s.name || knownContacts[s.shop]?.shopName || s.shop.replace(".myshopify.com", ""),
      merchantEmail: s.contactEmail || s.email || knownContacts[s.shop]?.merchantEmail || null,
      logoUrl: s.logoUrl || `https://${s.shop}/favicon.ico`,
    }))
    .sort((a, b) => a.shop.localeCompare(b.shop));

  return {
    shops: shopsWithContacts,
    actorName: actor.name,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const actor = await requireAdminUser(request, { users: adminUsers() });
  const form = await request.formData();

  const selectedShop = String(form.get("shop") ?? "").trim();
  const customShop = String(form.get("customShop") ?? "").trim();
  const shop = selectedShop === "custom" || !selectedShop ? customShop : selectedShop;
  const ccRaw = String(form.get("ccEmails") ?? "").trim();
  const ccEmails = ccRaw ? ccRaw.split(",").map((e) => e.trim()).filter(Boolean) : [];
  const categoryRaw = String(form.get("category") ?? "question");
  const category = toSupportCategory(categoryRaw) ?? "question";
  const subject = String(form.get("subject") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const uploadIds = String(form.get("uploadIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!shop) return { error: "Store domain is required. Select an installed store or enter a domain." };
  if (!subject) return { error: "Subject is required." };
  if (subject.length > SUBJECT_MAX) return { error: `Subject cannot exceed ${SUBJECT_MAX} characters.` };
  if (!body && uploadIds.length === 0) return { error: "Please enter a message or attach a file." };
  if (body.length > BODY_MAX) return { error: `Message cannot exceed ${BODY_MAX} characters.` };

  const created = await createTicketOnBehalf({
    shop,
    subject,
    body: body || "(See attached files)",
    category,
    ccEmails,
    staffName: actor.name,
    uploadIds,
  });

  if (!created.ok) return data({ error: "Failed to create ticket" }, { status: 500 });
  return redirect(`/internal/support/${created.value.id}`);
};

export default function NewInternalSupportTicket() {
  const { shops: registeredShops, actorName } = useLoaderData<typeof loader>();
  const actionData = useActionData<{ error?: string }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [selectedShop, setSelectedShop] = useState<string>(
    registeredShops.length > 0 ? registeredShops[0].shop : "custom",
  );
  const [customShop, setCustomShop] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<SupportCategory>("question");
  const [bodyText, setBodyText] = useState("");
  const [instruction, setInstruction] = useState("");
  const [tone, setTone] = useState<ReplyTone>(DEFAULT_TONE);

  const effectiveShop = selectedShop === "custom" ? customShop : selectedShop;
  const currentContact: ShopContactInfo = registeredShops.find((s) => s.shop === effectiveShop) ?? {
    shop: effectiveShop,
    isDevStore: false,
    shopName: effectiveShop ? effectiveShop.replace(".myshopify.com", "") : "Custom Store",
    merchantEmail: null,
    logoUrl: effectiveShop ? `https://${effectiveShop}/favicon.ico` : null,
  };

  const draft = useReplyDraft("body");
  const uploads = usePendingUploads("new", effectiveShop || undefined);

  const aiMode = instruction.trim() !== "" ? "generate" : bodyText.trim() !== "" ? "polish" : "suggest";
  const aiActionLabel = aiMode === "generate" ? "Write message" : aiMode === "polish" ? "Polish & optimize" : "Draft message";

  return (
    <Page
      title="New Support Ticket"
      subtitle="Proactively contact a merchant. Store information and email address are retrieved automatically from database records."
      backAction={{ href: "/internal/support", label: "Support Queue" }}
    >
      <BlockStack gap={6}>
        {actionData?.error && (
          <Alert variant="destructive">
            <AlertDescription>{actionData.error}</AlertDescription>
          </Alert>
        )}

        <Form method="post" className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
          <input type="hidden" name="shop" value={selectedShop} />

          {/* Left Column: Primary Form Fields */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recipient & Classification</CardTitle>
                <CardDescription>
                  Choose the destination merchant store. Contact email is retrieved from store records.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="shop-select">Target Store</Label>
                  <Select
                    value={selectedShop}
                    onValueChange={(val) => setSelectedShop(val)}
                  >
                    <SelectTrigger id="shop-select">
                      <SelectValue placeholder="Select a store" />
                    </SelectTrigger>
                    <SelectContent>
                      {registeredShops.map((s) => (
                        <SelectItem key={s.shop} value={s.shop}>
                          {s.shopName ? `${s.shopName} (${s.shop})` : s.shop} {s.isDevStore ? "(Dev Store)" : ""}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Other / Custom store domain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedShop === "custom" && (
                  <div className="space-y-2">
                    <Label htmlFor="customShop">Custom Store Domain</Label>
                    <Input
                      id="customShop"
                      name="customShop"
                      value={customShop}
                      onChange={(e) => setCustomShop(e.target.value)}
                      placeholder="e.g. luxe-bbq.myshopify.com or custom domain"
                      required
                    />
                  </div>
                )}

                {/* Auto-resolved Store Banner */}
                {effectiveShop && (
                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary overflow-hidden border border-border/50">
                        {currentContact.logoUrl ? (
                          <img
                            src={currentContact.logoUrl}
                            alt=""
                            className="size-6 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <Store className="size-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{currentContact.shopName}</span>
                          {currentContact.isDevStore && (
                            <Badge variant="secondary" className="text-[10px] h-4">Dev Store</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Mail className="size-3.5 text-muted-foreground" />
                          {currentContact.merchantEmail ? (
                            <span className="font-mono text-foreground font-medium">
                              {currentContact.merchantEmail}
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              No email address in records (portal notification only)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge variant={currentContact.merchantEmail ? "outline" : "secondary"}>
                      {currentContact.merchantEmail ? "Auto-detected" : "No email"}
                    </Badge>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      name="category"
                      value={category}
                      onValueChange={(val) => setCategory(toSupportCategory(val) ?? "question")}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORT_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {CATEGORY_LABEL_EN[cat]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ccEmails">CC Emails (Optional)</Label>
                    <Input
                      id="ccEmails"
                      name="ccEmails"
                      placeholder="e.g. support@example.com, dev@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="subject">Subject</Label>
                    <span className="text-xs text-muted-foreground">{subject.length}/{SUBJECT_MAX}</span>
                  </div>
                  <Input
                    id="subject"
                    name="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={SUBJECT_MAX}
                    placeholder="e.g. Follow-up regarding intake form setup"
                    required
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Message & Attachments</CardTitle>
                <CardDescription>
                  Write your message or let the AI optimize and draft it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* AI Assistant Box */}
                <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900/50 dark:bg-purple-950/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-purple-600 dark:text-purple-400" />
                      <Text as="span" className="text-xs font-semibold text-purple-950 dark:text-purple-200 uppercase tracking-wider">
                        AI Writing & Polish Assistant
                      </Text>
                    </div>
                    <Text as="span" className="text-[11px] text-muted-foreground">
                      Workers AI
                    </Text>
                  </div>
                  <Textarea
                    id="ai-instruction"
                    rows={2}
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="Tell the AI what to write (e.g. 'We investigated the checkout issue and deployed a fix, ask them to test')"
                    disabled={draft.state === "drafting"}
                    className="bg-background text-sm"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="tone-select" className="text-xs text-muted-foreground">Tone:</Label>
                      <Select value={tone} onValueChange={(next) => setTone(toReplyTone(next))}>
                        <SelectTrigger id="tone-select" className="w-32 h-8 text-xs" aria-label="Tone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REPLY_TONES.map((option) => (
                            <SelectItem key={option} value={option}>
                              {TONE_LABEL[option]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-purple-300 hover:bg-purple-100/60 dark:border-purple-800 dark:hover:bg-purple-950"
                      disabled={isSubmitting || draft.state === "drafting"}
                      onClick={() =>
                        void draft.draft({
                          ticketId: "new",
                          shop: effectiveShop,
                          subject,
                          category,
                          tone,
                          instruction,
                        })
                      }
                    >
                      <Sparkles className="mr-1.5 size-3.5 text-purple-600 dark:text-purple-400" />
                      {draft.state === "drafting" ? "Generating with AI…" : aiActionLabel}
                    </Button>
                  </div>
                  {draft.error && (
                    <p className="mt-2 text-xs text-destructive">{draft.error}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="body">Message Body</Label>
                    <span className="text-xs text-muted-foreground">{bodyText.length}/{BODY_MAX}</span>
                  </div>
                  <Textarea
                    id="body"
                    name="body"
                    rows={6}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    maxLength={BODY_MAX}
                    placeholder="Write your message to the merchant, or use the AI assistant above..."
                  />
                  <p className="text-xs text-muted-foreground">
                    This message will be emailed to the merchant and visible in their embedded support portal.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <Label>Attachments</Label>
                  <InternalAttachmentPicker uploads={uploads} />
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" asChild>
                <a href="/internal/support">Cancel</a>
              </Button>
              <Button type="submit" disabled={isSubmitting || uploads.busy} className="gap-2">
                <Send className="size-4" />
                {isSubmitting ? "Creating & Sending..." : "Create Ticket & Email Merchant"}
              </Button>
            </div>
          </div>

          {/* Right Column: Preview & Staff Context */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Outreach Preview</CardTitle>
                <CardDescription>
                  Summary of how this ticket will be delivered.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5 text-sm">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-muted-foreground text-xs">Destination:</span>
                  <span className="font-mono text-xs truncate max-w-[160px]">{effectiveShop || "—"}</span>
                </div>
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-muted-foreground text-xs">Merchant:</span>
                  <span className="font-medium text-xs truncate max-w-[160px]">{currentContact.shopName}</span>
                </div>
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-muted-foreground text-xs">Recipient:</span>
                  {currentContact.merchantEmail ? (
                    <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[160px]">
                      {currentContact.merchantEmail}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600">No email found</span>
                  )}
                </div>
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-muted-foreground text-xs">Author:</span>
                  <span className="text-xs font-medium">{actorName}</span>
                </div>
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-muted-foreground text-xs">Initial Status:</span>
                  <Badge variant="secondary" className="text-xs font-normal">Waiting on merchant</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/20 border-dashed">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Info className="size-4 text-primary" />
                  <CardTitle className="text-sm">Proactive Outreach</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p>
                  • <strong>Email Dispatch:</strong> When created, an email with your message and direct thread link is sent to the merchant.
                </p>
                <p>
                  • <strong>Replies:</strong> When the merchant replies by email or in the app, their response reopens the ticket and notifies staff.
                </p>
                <p>
                  • <strong>AI Polish:</strong> You can quickly type bullet notes and click &ldquo;Polish &amp; optimize&rdquo; to draft a professional message.
                </p>
              </CardContent>
            </Card>
          </div>
        </Form>
      </BlockStack>
    </Page>
  );
}
