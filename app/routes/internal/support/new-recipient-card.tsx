import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "ngk-dashboard";
import { Mail, Store } from "lucide-react";
import { CATEGORY_LABEL_EN, SUPPORT_CATEGORIES, toSupportCategory } from "~/support/categories";
import { SUBJECT_MAX } from "~/schemas/support";
import type { NewTicketForm, ShopContactInfo } from "./new-form-state";

function ShopSelect({ shops, form }: { readonly shops: readonly ShopContactInfo[]; readonly form: NewTicketForm }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="shop-select">Target Store</Label>
      <Select value={form.selectedShop} onValueChange={(val) => form.setSelectedShop(val)}>
        <SelectTrigger id="shop-select">
          <SelectValue placeholder="Select a store" />
        </SelectTrigger>
        <SelectContent>
          {shops.map((s) => (
            <SelectItem key={s.shop} value={s.shop}>
              {s.shopName ? `${s.shopName} (${s.shop})` : s.shop} {s.isDevStore ? "(Dev Store)" : ""}
            </SelectItem>
          ))}
          <SelectItem value="custom">Other / Custom store domain</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function CustomShopField({ form }: { readonly form: NewTicketForm }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="customShop">Custom Store Domain</Label>
      <Input
        id="customShop"
        name="customShop"
        value={form.customShop}
        onChange={(e) => form.setCustomShop(e.target.value)}
        placeholder="e.g. luxe-bbq.myshopify.com or custom domain"
        required
      />
    </div>
  );
}

function ContactEmail({ email }: { readonly email: string | null }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
      <Mail className="size-3.5 text-muted-foreground" />
      {email ? (
        <span className="font-mono text-foreground font-medium">{email}</span>
      ) : (
        <span className="text-amber-600 dark:text-amber-400">
          No email address in records (portal notification only)
        </span>
      )}
    </div>
  );
}

function ContactLogo({ logoUrl }: { readonly logoUrl: string | null }) {
  return (
    <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary overflow-hidden border border-border/50">
      {logoUrl ? (
        <img
          src={logoUrl}
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
  );
}

/** Auto-resolved store banner. */
function ContactBanner({ contact }: { readonly contact: ShopContactInfo }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 p-3.5">
      <div className="flex items-center gap-3">
        <ContactLogo logoUrl={contact.logoUrl} />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{contact.shopName}</span>
            {contact.isDevStore && <Badge variant="secondary" className="text-[10px] h-4">Dev Store</Badge>}
          </div>
          <ContactEmail email={contact.merchantEmail} />
        </div>
      </div>
      <Badge variant={contact.merchantEmail ? "outline" : "secondary"}>
        {contact.merchantEmail ? "Auto-detected" : "No email"}
      </Badge>
    </div>
  );
}

function CategoryAndCc({ form }: { readonly form: NewTicketForm }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          name="category"
          value={form.category}
          onValueChange={(val) => form.setCategory(toSupportCategory(val) ?? "question")}
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
        <Input id="ccEmails" name="ccEmails" placeholder="e.g. support@example.com, dev@example.com" />
      </div>
    </div>
  );
}

function SubjectField({ form }: { readonly form: NewTicketForm }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label htmlFor="subject">Subject</Label>
        <span className="text-xs text-muted-foreground">{form.subject.length}/{SUBJECT_MAX}</span>
      </div>
      <Input
        id="subject"
        name="subject"
        value={form.subject}
        onChange={(e) => form.setSubject(e.target.value)}
        maxLength={SUBJECT_MAX}
        placeholder="e.g. Follow-up regarding intake form setup"
        required
      />
    </div>
  );
}

export function RecipientCard({ shops, form }: { readonly shops: readonly ShopContactInfo[]; readonly form: NewTicketForm }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recipient & Classification</CardTitle>
        <CardDescription>
          Choose the destination merchant store. Contact email is retrieved from store records.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ShopSelect shops={shops} form={form} />
        {form.selectedShop === "custom" && <CustomShopField form={form} />}
        {form.effectiveShop && <ContactBanner contact={form.currentContact} />}
        <CategoryAndCc form={form} />
        <SubjectField form={form} />
      </CardContent>
    </Card>
  );
}
