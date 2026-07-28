# 604SellsCars SMS automation

This folder contains source-controlled copies of the three active n8n
workflows that automate appointment SMS:

- `604sellscars-intake.workflow.ts` — booking confirmation and owner alert.
- `604sellscars-reminders.workflow.ts` — 24-hour, 3-hour, and 1-hour reminders.
- `604sellscars-inbound-sms.workflow.ts` — inbound replies, text cancellation,
  owner forwarding, and lead-desk cancellation notifications.

The database migration, API deployment, private credentials, Twilio inbound
webhook, and production activation were completed on July 28, 2026. Keep the
workflow IDs and activation order below as the recovery runbook.

## Saved n8n drafts

- Workflow A — Intake: `Ko7ZP32RNzDxshoV`
- Workflow B — Reminder engine: `Kph4AjdhaUoEd1Hq`
- Workflow C — Inbound SMS and cancellation: `1qRvynMWcB64pvrb`

## Required private configuration

Create these credentials in n8n. Do not paste their values into workflow nodes or
commit them to Git.

1. `Twilio account`
   - Twilio Account SID
   - Twilio Auth Token
2. `604SellsCars Automation API`
   - Header name: `x-604sc-automation-key`
   - Header value: the same strong random value used for
     `N8N_AUTOMATION_API_KEY` in the lead API.
3. `604SellsCars Intake Webhook`
   - Header name: `x-604sc-automation-key`
   - Header value: the same strong random value.

The Canadian Twilio sender number is source-controlled in the workflow nodes.
The owner notification number is configured only in n8n and is intentionally
not committed to Git.

Set these variables on the deployed lead API:

```text
N8N_INTAKE_WEBHOOK_URL=https://n8n.agdigitalz.net/webhook/604sellscars-booking-intake
N8N_CANCELLATION_WEBHOOK_URL=https://n8n.agdigitalz.net/webhook/604sellscars-desk-cancellation
N8N_AUTOMATION_API_KEY=<same strong random value used by both n8n header credentials>
```

The existing Supabase and admin environment variables remain unchanged.

## Recovery and activation order

1. Apply `supabase/migrations/20260728061034_add_lead_sms_automation.sql`.
2. Deploy the lead API, booking form, and lead desk.
3. Confirm the booking form displays the SMS consent checkbox.
4. Create and attach the three n8n credentials listed above.
5. Replace the Twilio sender and owner-number placeholders in all three workflows.
6. Point the Twilio number's inbound messaging webhook to:
   `https://n8n.agdigitalz.net/webhook/604sellscars-inbound-sms`
   using HTTP POST.
7. Activate Workflow C, then Workflow B, then Workflow A. This is the current
   production activation order.
8. Run every test below using an owner-controlled verified phone number.
9. Add `META_PIXEL_ID` to the customer-web environment and confirm a successful
   form submission fires one Meta `Lead` event before running ads.

## End-to-end test checklist

- Submit with consent enabled: customer receives T1 and owner receives T2.
- Submit without consent: customer receives nothing and owner still receives T2.
- Verify the stored phone is E.164 and the appointment is UTC.
- Set an appointment about 24 hours away and run Workflow B twice: T3 sends once.
- Repeat at about 3 hours and 1 hour: T4 and T5 each send once.
- Reply `CANCEL`: status becomes `cancelled`; customer gets T6; owner gets T7.
- Cancel a fresh lead in the lead desk: the same status changes and notifications
  occur.
- Run Workflow B after either cancellation path: no reminder is sent.
- Send a non-CANCEL reply: owner receives T8.
- Check every customer-facing date and time in Pacific time.
- Confirm Twilio's STOP/START/HELP handling remains enabled.

## Operational rules

- `appointment_status` is the single source of truth.
- Active statuses are `new`, `assigned`, and `booked`.
- Terminal statuses are `cancelled`, `completed`, and `no_show`.
- Customer SMS is allowed only when `consent_sms` is true.
- Owner alerts are internal and are not suppressed by customer SMS consent.
- The reminder engine polls every 15 minutes and sends only the earliest
  qualifying unsent stage per lead.
- The legacy `reminder_2h_sent_at` field remains only for compatibility and is
  not used by these workflows.
