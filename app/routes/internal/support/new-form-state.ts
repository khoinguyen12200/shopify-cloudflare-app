import { useState } from "react";
import type { SupportCategory } from "~/support/categories";
import { DEFAULT_TONE, type ReplyTone } from "~/ai/tones";

export interface ShopContactInfo {
  readonly shop: string;
  readonly isDevStore: boolean;
  readonly shopName: string;
  readonly merchantEmail: string | null;
  readonly logoUrl: string | null;
}

function resolveContact(shops: readonly ShopContactInfo[], effectiveShop: string): ShopContactInfo {
  return (
    shops.find((s) => s.shop === effectiveShop) ?? {
      shop: effectiveShop,
      isDevStore: false,
      shopName: effectiveShop ? effectiveShop.replace(".myshopify.com", "") : "Custom Store",
      merchantEmail: null,
      logoUrl: effectiveShop ? `https://${effectiveShop}/favicon.ico` : null,
    }
  );
}

/** Every controlled field of the new-ticket form, plus the contact they resolve to. */
export function useNewTicketForm(registeredShops: readonly ShopContactInfo[]) {
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
  const currentContact = resolveContact(registeredShops, effectiveShop);

  return {
    selectedShop,
    setSelectedShop,
    customShop,
    setCustomShop,
    subject,
    setSubject,
    category,
    setCategory,
    bodyText,
    setBodyText,
    instruction,
    setInstruction,
    tone,
    setTone,
    effectiveShop,
    currentContact,
  };
}

export type NewTicketForm = ReturnType<typeof useNewTicketForm>;
