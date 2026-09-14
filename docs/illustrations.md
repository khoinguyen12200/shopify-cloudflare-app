# Illustration assets

## Setup guide onboarding

- File: `public/illustrations/undraw/setup-analytics.svg`
- Source: https://undraw.co/illustrations/setup-analytics.svg
- Collection: [unDraw](https://undraw.co/illustrations)
- License: review the current unDraw license before redistribution or branding changes.

Use this asset for onboarding/setup-guide content where the merchant configures their first workflow. Keep the alt text translated and describe the purpose rather than the artwork:

```tsx
<s-image
  src="/illustrations/undraw/setup-analytics.svg"
  alt={t("setupGuide.illustrationAlt")}
  aspectRatio="1/0.75"
  objectFit="contain"
  loading="lazy"
></s-image>
```

## Online search

Search current provider results without maintaining a local catalog:

```bash
npm run illustrations:search -- "onboarding setup" --limit 10
```

This fetches the public unDraw search page, extracts direct CDN SVG URLs, and prints the source and license link. Select a result, download it through its direct URL, and record the title, source page, license, and local filename here. Always check the provider's current license before shipping.

## Quick online search and download

```bash
npm run illustrations:search -- "onboarding setup" --limit 10
npm run illustrations:download -- "https://cdn.undraw.co/illustration/setup-wizard_45kx.svg" --out public/illustrations/onboarding.svg
```

Search results include the creator, license, source page, and direct download URL. The downloader accepts a selected URL, verifies that the response is an image, and writes it to the requested path. Record attribution and license details beside the asset or in this document.

## Dashboard setup guide

These local assets support the three sample onboarding steps in the embedded
dashboard. They were selected from unDraw search results and downloaded from the
listed CDN URLs.

| File                                     | Source page                                 | Download URL                                                  | License                                     |
| ---------------------------------------- | ------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------- |
| `public/illustrations/onboarding.svg`    | https://undraw.co/search/setup              | https://cdn.undraw.co/illustration/onboarding_dcq2.svg        | [unDraw license](https://undraw.co/license) |
| `public/illustrations/catalog.svg`       | https://undraw.co/search/product            | https://cdn.undraw.co/illustration/product-explainer_b7ft.svg | [unDraw license](https://undraw.co/license) |
| `public/illustrations/analytics.svg`     | https://undraw.co/search/analytics          | https://cdn.undraw.co/illustration/analytics-setup_ptrz.svg   | [unDraw license](https://undraw.co/license) |
| `public/illustrations/support-empty.svg` | https://undraw.co/search/customer%20support | https://cdn.undraw.co/illustration/faq_pgxi.svg               | [unDraw license](https://undraw.co/license) |
