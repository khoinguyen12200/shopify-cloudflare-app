# Legal Content Template

This template is operational guidance, not legal advice. Replace every
`TODO:` value before production release. Have qualified counsel review final
privacy and terms content for jurisdictions where you operate or sell.

## Required Identity

Fill `app/legal/content.ts` and both locale files with:

| Field | Required value |
| --- | --- |
| App name | `TODO: <merchant-facing app name>` |
| Legal entity | `TODO: <registered company or individual>` |
| Privacy contact | `TODO: <monitored email>` |
| Physical address | `TODO: <address if required>` |
| Effective date | `TODO: YYYY-MM-DD` |

## Privacy Policy Inventory

For each data type, complete this row before launch. Do not state that data is
not collected if logs, support tickets, sessions, analytics, AI, or a vendor
receive it.

| Data category | Source | Purpose | Storage region | Retention | Recipient/subprocessor | Lawful basis / authority |
| --- | --- | --- | --- | --- | --- | --- |
| `TODO: merchant account data` | `TODO: Shopify` | `TODO: provide app` | `TODO:` | `TODO:` | `TODO:` | `TODO:` |
| `TODO: support data` | `TODO: merchant` | `TODO: answer support` | `TODO:` | `TODO:` | `TODO:` | `TODO:` |
| `TODO: customer data, if any` | `TODO:` | `TODO:` | `TODO:` | `TODO:` | `TODO:` | `TODO:` |

Document every processor separately: Shopify, Cloudflare, email provider,
analytics provider, support provider, and AI provider. Name service, role,
region, data categories, and current privacy/DPA URL.

## Privacy Sections

- **Collection:** list exact fields, not labels such as "usage data".
- **Use:** map each category to a feature; state training/profiling/automated
  decision use explicitly.
- **Sharing:** list every vendor and why it receives data.
- **Retention:** give event and deletion rules. Include `shop/redact` workflow.
- **Security:** state only controls actually enabled: TLS, encryption at rest,
  least privilege, incident process, access review.
- **Rights:** give contact route, identity verification process, response target,
  and Shopify compliance webhook behavior.
- **Changes:** state notice channel and effective-date process.

## Terms Sections

- **Agreement:** name parties and acceptance mechanism.
- **Service:** describe real product, exclusions, and merchant responsibility.
- **Billing:** match Managed Pricing handles, currencies, trials, cancellation,
  refunds, and tax treatment.
- **Support/availability:** state only support hours and SLA actually offered.
- **Liability, warranties, law:** counsel-reviewed jurisdiction-specific text.
- **Termination:** state merchant/export/deletion behavior and retention limits.

## Release Checklist

- [ ] No `TODO:` remains in public legal, support, pricing, app name, or plans.
- [ ] Privacy inventory covers every D1/KV/R2 row and external processor.
- [ ] Managed Pricing plan handles match Partner Dashboard configuration.
- [ ] Contact inbox is monitored and physical address is correct where required.
- [ ] Counsel approved final privacy policy and terms.
- [ ] `npm run check:placeholders` passes only with completed production config.
