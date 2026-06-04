# Cevonne Website Integration Spec for Codex

**File suggestion:** `docs/Cevonne_Website_n8n_Integration_for_Codex.md`  
**Purpose:** Guide Codex while integrating the completed Cevonne n8n workflow system into the website codebase.  
**Integration mode:** Website backend -> n8n webhooks -> Supabase/Neon/compliance workflow.  
**Core rule:** The website must never bypass G1/G3/G6/G9/G10/G11 safety rules.

---

## 1. Current final architecture

The active automation system is the G-series compliance-first workflow architecture:

- G1 - Compliance Guard
- G2 - Policy + Account Health Monitor
- G3 - CRM + Consent + Attribution
- G4 - Content Intelligence + Approval
- G5 - Publishing Scheduler
- G6 - Messaging + Quiz + Recovery Router
- G7 - Inventory + Offer Safety
- G8 - UGC + Creator Proof
- G9 - Ads + Retargeting Optimizer
- G10 - SEO + CRO
- G11 - Decision Engine

The website should not re-create workflow logic. The website should only send clean, validated events to the correct n8n webhook through backend API routes.

---

## 2. Important non-negotiable rules for Codex

Do not build direct frontend calls to n8n webhooks. Use backend/server API routes only.

Do not expose these in client-side code:

- Supabase service role key
- Neon database URL
- n8n credentials
- Meta tokens
- Google tokens
- WhatsApp/BSP tokens
- ManyChat/partner keys
- HubSpot private keys
- webhook signing secrets

Do not add direct website calls to Meta, Instagram, WhatsApp, Google Ads, Google Search scraping, Shopify write actions, HubSpot writes, or CMS publishing unless the action is explicitly routed through the approved workflow path.

Do not create a separate CRM for every workflow. Use G3 as the shared CRM/consent/attribution backbone.

Do not treat a BLOCK response as an error to work around. A BLOCK is a valid safety response. Stop the user/business action and show a safe message.

---

## 3. Answer: Do we need to make a CRM for every workflow?

No.

Cevonne should have one shared CRM/consent/attribution backbone, handled by G3. Each workflow should not create its own CRM.

Correct model:

```text
Website / Storefront
-> backend API route
-> G3 CRM + Consent + Attribution
-> shared contact / consent / attribution records
-> other workflows reference G3 status when needed
```

Workflow-specific tables are allowed, but they are not separate CRMs. Examples:

- G7 can have offer/inventory proof logs.
- G8 can have UGC rights and creator proof logs.
- G9 can have ad recommendation, approval, and execution logs.
- G10 can have SEO/CRO recommendation and experiment logs.
- G11 can have digest, recommendation, source snapshot, and action packet draft logs.

Those tables should reference shared IDs or safe metadata where relevant. They should not duplicate the full customer CRM.

Use G3 for:

- contacts
- consent
- opt-outs
- attribution
- purchase/recovery suppression
- privacy requests
- deletion/export request tracking
- safe source-of-truth checks before messaging, retargeting, or audience actions

HubSpot, if used, is a CRM view or sales/marketing interface. It is not the compliance source of truth.

---

## 4. Website integration approach

Codex should add a small integration layer in the website backend.

Recommended structure for a Next.js-style project:

```text
/lib/cevonne/n8nClient.ts
/lib/cevonne/validation.ts
/app/api/cevonne/consent/route.ts
/app/api/cevonne/opt-out/route.ts
/app/api/cevonne/attribution/route.ts
/app/api/cevonne/purchase/route.ts
/app/api/cevonne/privacy-request/route.ts
/app/api/cevonne/quiz-or-recovery/route.ts
/app/api/cevonne/admin/g11-digest/route.ts
/app/api/cevonne/admin/g11-recommendation/route.ts
/app/api/cevonne/admin/g11-action-draft/route.ts
```

If the website is not Next.js, use equivalent backend/server endpoints. The key requirement is that browser code calls the website backend, and the backend calls n8n.

---

## 5. Required environment variables

Add these to server-only environment config.

```env
CEVONNE_N8N_ENABLED=true
CEVONNE_N8N_DRY_RUN=true
CEVONNE_SITE_SOURCE=website
CEVONNE_PRIVACY_POLICY_VERSION=2026-website-v1

N8N_WEBHOOK_SHARED_SECRET=

N8N_G3_CONSENT_INGEST_URL=https://n8n.cevonne.com/webhook/g3-consent-ingest
N8N_G3_OPT_OUT_URL=https://n8n.cevonne.com/webhook/g3-opt-out
N8N_G3_ATTRIBUTION_EVENT_URL=https://n8n.cevonne.com/webhook/g3-attribution-event
N8N_G3_PURCHASE_EVENT_URL=https://n8n.cevonne.com/webhook/g3-purchase-event
N8N_G3_PRIVACY_REQUEST_URL=https://n8n.cevonne.com/webhook/g3-privacy-request
N8N_G3_PRIVACY_EXECUTE_URL=https://n8n.cevonne.com/webhook/g3-privacy-execute

# Confirm final G6 URL in n8n before enabling this route.
N8N_G6_MESSAGING_ROUTER_URL=

# Admin/founder dashboard only.
N8N_G11_WEEKLY_DIGEST_URL=https://n8n.cevonne.com/webhook/g11-weekly-decision-digest
N8N_G11_DECISION_RECOMMENDATION_URL=https://n8n.cevonne.com/webhook/g11-decision-recommendation
N8N_G11_DRAFT_ACTION_PACKET_URL=https://n8n.cevonne.com/webhook/g11-draft-action-packet
```

Never expose these variables to the frontend. Do not prefix them with public/client environment prefixes.

---

## 6. Standard n8n client behavior

Create one reusable server helper to call n8n.

Expected behavior:

1. Accept a webhook URL and JSON payload.
2. Add request ID and timestamp.
3. Add a server-generated source header.
4. Optionally add HMAC signature if the matching n8n workflow verifies it.
5. Use timeout.
6. Parse JSON.
7. Return PASS/BLOCK/MANUAL_ONLY/ERROR cleanly to the website route.
8. Never retry unsafe writes automatically.

Suggested response type:

```ts
type CevonneN8nStatus = 'PASS' | 'BLOCK' | 'MANUAL_ONLY' | 'ERROR';

type CevonneN8nResponse = {
  status: CevonneN8nStatus;
  response_type?: string;
  fail_reason?: string | null;
  failure_reasons?: string[];
  message?: string;
  id?: string;
  recommendation_only?: boolean;
  dry_run?: boolean;
  not_executed?: boolean;
  handled_at?: string;
  [key: string]: unknown;
};
```

Suggested request headers:

```text
Content-Type: application/json
X-Cevonne-Source: website
X-Cevonne-Request-Id: <uuid>
X-Cevonne-Timestamp: <iso timestamp>
X-Cevonne-Signature: <optional hmac>
```

---

## 7. Website events that must call G3

### 7.1 Consent ingest

Call when a user gives explicit consent for email, SMS, WhatsApp, tracking, quiz, recovery, or marketing.

Backend route:

```text
POST /api/cevonne/consent
```

n8n target:

```text
POST ${N8N_G3_CONSENT_INGEST_URL}
```

Minimum payload:

```json
{
  "workflow_group": "G3",
  "event_type": "CONSENT_INGEST",
  "source_platform": "WEBSITE",
  "source_event": "newsletter_signup",
  "email": "customer@example.com",
  "phone": null,
  "channel": "EMAIL",
  "consent_status": "YES",
  "explicit_consent": true,
  "privacy_policy_version": "2026-website-v1",
  "utm_source": null,
  "utm_medium": null,
  "utm_campaign": null,
  "actor": "website",
  "request_id": "uuid"
}
```

Frontend rule:

Only send `consent_status: YES` when the user has actively opted in. Do not pre-check consent boxes.

---

### 7.2 Opt-out

Call when a user unsubscribes, sends STOP, disables a channel, or requests no future messages.

Backend route:

```text
POST /api/cevonne/opt-out
```

n8n target:

```text
POST ${N8N_G3_OPT_OUT_URL}
```

Minimum payload:

```json
{
  "workflow_group": "G3",
  "event_type": "OPT_OUT",
  "contact_id": "uuid-or-null",
  "email": "customer@example.com",
  "phone": null,
  "channel": "EMAIL",
  "opt_out_reason": "user_unsubscribe",
  "source_platform": "WEBSITE",
  "actor": "website",
  "request_id": "uuid"
}
```

Frontend rule:

After a successful opt-out, immediately update UI state so the user is not asked to opt in again in the same session.

---

### 7.3 Attribution event

Call only after tracking consent exists, or when the event is anonymous and privacy-safe.

Backend route:

```text
POST /api/cevonne/attribution
```

n8n target:

```text
POST ${N8N_G3_ATTRIBUTION_EVENT_URL}
```

Minimum payload:

```json
{
  "workflow_group": "G3",
  "event_type": "ATTRIBUTION_EVENT",
  "contact_id": "uuid-or-null",
  "event_name": "page_view_or_lead_or_purchase",
  "source_platform": "WEBSITE",
  "utm_source": "instagram",
  "utm_medium": "paid_social",
  "utm_campaign": "campaign-name",
  "gclid": null,
  "fbclid": null,
  "meta_event_id": "dedupe-event-id-or-null",
  "tracking_consent_status": "YES",
  "actor": "website",
  "request_id": "uuid"
}
```

Frontend rule:

Do not send identifiable attribution if tracking consent is missing, revoked, or unknown.

---

### 7.4 Purchase event and recovery suppression

Call after checkout success or confirmed order creation.

Backend route:

```text
POST /api/cevonne/purchase
```

n8n target:

```text
POST ${N8N_G3_PURCHASE_EVENT_URL}
```

Minimum payload:

```json
{
  "workflow_group": "G3",
  "event_type": "PURCHASE_EVENT",
  "order_id": "shopify-or-store-order-id",
  "contact_id": "uuid-or-null",
  "email": "customer@example.com",
  "phone": null,
  "purchase_value": 2499,
  "currency": "INR",
  "items": [
    {
      "sku": "SKU-001",
      "product_id": "product-id",
      "quantity": 1
    }
  ],
  "source_platform": "WEBSITE",
  "actor": "website",
  "request_id": "uuid"
}
```

Business rule:

Once purchase is recorded, cart recovery must stop for that order/contact where applicable.

---

### 7.5 Privacy request

Call when a user requests deletion, export, correction, or privacy support.

Backend route:

```text
POST /api/cevonne/privacy-request
```

n8n target:

```text
POST ${N8N_G3_PRIVACY_REQUEST_URL}
```

Minimum payload:

```json
{
  "workflow_group": "G3",
  "event_type": "PRIVACY_REQUEST",
  "request_type": "DELETE",
  "email": "customer@example.com",
  "phone": null,
  "contact_id": "uuid-or-null",
  "verification_status": "PENDING",
  "source_platform": "WEBSITE",
  "actor": "website",
  "request_id": "uuid"
}
```

Business rule:

Do not automatically delete production website/customer/order/cart data unless exact Neon production table mappings are confirmed and the G3 privacy-execute workflow is explicitly approved for live destructive execution.

---

## 8. G6 messaging, quiz, and recovery integration

The website can collect quiz inputs, WhatsApp opt-in intent, or cart recovery intent, but it must not send WhatsApp, SMS, email, or IG DM directly from the frontend.

Use this pattern:

```text
Website form / quiz
-> backend route
-> G3 consent check or consent ingest
-> G6 messaging router / verified provider route
-> provider sends message only if allowed
```

G6 rules Codex must preserve:

- No direct outbound Instagram DM from n8n or the website.
- IG DM must use an approved Meta messaging partner route.
- WhatsApp must use an official WhatsApp BSP or approved platform.
- WhatsApp quiz must require explicit YES opt-in.
- STOP/opt-out must block future messages.
- Cart recovery must stop after purchase.
- Messaging outside allowed windows must be blocked.

Do not implement direct WhatsApp links or automation that imply consent unless G3 records consent and G6 confirms allowed routing.

---

## 9. G10 SEO/CRO website integration

G10 should not auto-publish website changes unless the workflow approval and compliance requirements are met.

For the website codebase:

- Do not add Google Search scraping.
- Do not add automated SERP queries.
- Do not create doorway pages.
- Do not generate mass low-value AI pages.
- Do not create fake reviews or fake author identity.
- Do not install unmasked session recording.
- Do not track sensitive form fields, phone numbers, email fields, photos, checkout fields, or payment fields in recordings.
- Only enable Clarity/PostHog-style CRO analytics when cookie consent, masking, and retention limits are configured.

Any CMS/page-changing feature must go through the approved G10/G1/human-approval route before publishing.

---

## 10. G11 founder/admin dashboard integration

G11 is recommendation-only. It must not execute platform or website write actions.

Admin-only routes may call:

```text
POST ${N8N_G11_WEEKLY_DIGEST_URL}
POST ${N8N_G11_DECISION_RECOMMENDATION_URL}
POST ${N8N_G11_DRAFT_ACTION_PACKET_URL}
```

G11 can produce:

- weekly digest
- decision recommendation
- downstream action-packet draft

G11 must not:

- call Meta write APIs
- call Google write APIs
- call WhatsApp/IG DM sends
- call Shopify writes
- call HubSpot writes
- call CMS writes
- bypass G1
- bypass human approval

Admin UI should label G11 outputs clearly as recommendations, not executed actions.

---

## 11. Standard frontend handling for n8n responses

For `PASS`:

- Continue the user flow.
- Show success state if user-facing.
- Store returned IDs if needed.

For `BLOCK`:

- Stop the action.
- Do not retry automatically.
- Show a safe user-friendly message.
- Log the request ID for support/debugging.

For `MANUAL_ONLY`:

- Stop automation.
- Show that manual review is required.
- Do not execute website/platform changes.

For `ERROR`:

- Show temporary failure.
- Allow safe retry only for non-write events.
- Do not retry external write-like actions without idempotency.

Suggested UI-safe message:

```text
We could not complete this automatically. Your request has been received for review or support.
```

Do not expose internal fail reasons like policy names or account-health details to public users unless intentionally designed for admin users.

---

## 12. Idempotency and duplicate prevention

Every website backend call to n8n should include:

```json
{
  "request_id": "uuid",
  "event_id": "stable-event-id-if-known",
  "received_at": "iso_timestamp"
}
```

Use stable IDs where possible:

- order ID for purchases
- email + channel + timestamp bucket for consent
- generated UUID for privacy request
- checkout/cart ID for recovery events
- Meta/GA event ID for attribution dedupe

Do not send duplicate purchase or attribution events without dedupe IDs.

---

## 13. Cookie and consent behavior

Cookie/analytics behavior must follow consent state.

Before tracking consent:

- only essential cookies
- no identifiable attribution
- no session recording
- no Pixel/CAPI identifiable event use
- no retargeting audience sync

After tracking consent:

- attribution event can be sent to G3
- allowed analytics can run
- Pixel/CAPI events can be sent only if configured and approved
- CRO tools can run only with masking and retention limits

If user opts out:

- stop channel messages
- stop identifiable tracking where required
- update UI preferences
- call G3 opt-out

---

## 14. Codex implementation checklist

Codex should complete these steps:

```text
[ ] Add server-only n8n environment variables.
[ ] Create reusable n8n client helper.
[ ] Create backend route for consent ingest.
[ ] Create backend route for opt-out.
[ ] Create backend route for attribution event.
[ ] Create backend route for purchase event.
[ ] Create backend route for privacy request.
[ ] Add optional backend route for G6 quiz/recovery only after final G6 URL is confirmed.
[ ] Add admin-only routes for G11 digest, recommendation, and action draft if the website has an admin dashboard.
[ ] Connect newsletter/form consent to /api/cevonne/consent.
[ ] Connect unsubscribe/preferences to /api/cevonne/opt-out.
[ ] Connect UTM/click tracking to /api/cevonne/attribution only after consent.
[ ] Connect checkout success/order created to /api/cevonne/purchase.
[ ] Connect privacy page form to /api/cevonne/privacy-request.
[ ] Add request_id to every call.
[ ] Add safe PASS/BLOCK/MANUAL_ONLY/ERROR handling.
[ ] Ensure no n8n webhook URL is exposed to browser JS.
[ ] Ensure no service role/API secrets are exposed to browser JS.
[ ] Add tests for PASS response.
[ ] Add tests for BLOCK response.
[ ] Add tests for MANUAL_ONLY response.
[ ] Add test proving opt-out blocks further messaging flow.
[ ] Add test proving purchase suppresses recovery flow.
```

---

## 15. Testing plan

### Consent tests

```text
[ ] Missing email/phone/contact ID returns BLOCK.
[ ] consent_status YES without explicit_consent true returns BLOCK.
[ ] Valid email consent returns PASS.
[ ] Valid tracking consent returns PASS.
```

### Attribution tests

```text
[ ] Attribution without consent returns BLOCK.
[ ] Attribution with tracking consent returns PASS.
[ ] Duplicate event ID does not create duplicate conversion logic.
```

### Opt-out tests

```text
[ ] Missing channel returns BLOCK.
[ ] Valid opt-out returns PASS.
[ ] Website UI stops future messaging prompts for opted-out channel.
```

### Purchase tests

```text
[ ] Missing order_id returns BLOCK.
[ ] Valid purchase returns PASS.
[ ] Recovery suppression is returned or logged.
[ ] Cart recovery does not continue after purchase.
```

### Privacy tests

```text
[ ] Missing request_type returns BLOCK.
[ ] Verified request creates manual execution-ready record.
[ ] Destructive delete/export remains MANUAL_ONLY unless Neon production mappings are approved.
```

### Security tests

```text
[ ] No n8n webhook URLs in client bundle.
[ ] No secret keys in client bundle.
[ ] Backend route rate limit exists for public forms.
[ ] Invalid/missing internal secret is rejected if signature verification is enabled.
```

---

## 16. Final integration decision

The website should integrate with the completed workflows through a controlled backend integration layer.

The website must mainly connect to G3 for customer/consent/attribution/purchase/privacy events, optionally G6 for messaging/quiz/recovery, G10 for approved SEO/CRO actions, and G11 only for admin/founder recommendations.

Do not build a CRM for every workflow. Build one shared CRM/consent source through G3, and let each workflow keep only its own workflow-specific audit/recommendation/execution tables.
