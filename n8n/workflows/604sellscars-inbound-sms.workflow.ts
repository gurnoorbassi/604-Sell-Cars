import {
  expr,
  ifElse,
  newCredential,
  node,
  placeholder,
  sticky,
  trigger,
  workflow,
} from "@n8n/workflow-sdk";

const inboundWebhook = trigger({
  type: "n8n-nodes-base.webhook",
  version: 2.1,
  config: {
    name: "Receive Twilio Inbound SMS",
    parameters: {
      httpMethod: "POST",
      path: "604sellscars-inbound-sms",
      authentication: "none",
      responseMode: "onReceived",
      options: {
        noResponseBody: true,
        responseCode: { values: { responseCode: 204 } },
      },
    },
    position: [220, 340],
  },
  output: [{
    body: {
      From: "+16045550123",
      To: "+16045550999",
      Body: "CANCEL",
      MessageSid: "SM_TEST_INBOUND",
    },
  }],
});

const deskCancellationWebhook = trigger({
  type: "n8n-nodes-base.webhook",
  version: 2.1,
  config: {
    name: "Receive Lead Desk Cancellation",
    parameters: {
      httpMethod: "POST",
      path: "604sellscars-desk-cancellation",
      authentication: "headerAuth",
      responseMode: "onReceived",
      options: {
        noResponseBody: true,
        responseCode: { values: { responseCode: 204 } },
      },
    },
    credentials: {
      httpHeaderAuth: newCredential("604SellsCars Intake Webhook"),
    },
    position: [1260, -80],
  },
  output: [{
    body: {
      leadId: 123,
      customerName: "Test Customer",
      customerPhone: "+16045550123",
      vehicle: "2022 Mercedes-Benz GLE 63 S AMG",
      appointmentAt: "2026-07-30T20:00:00.000Z",
      status: "cancelled",
      consentSms: true,
    },
  }],
});

const extractDeskCancellation = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Extract Lead Desk Cancellation",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode:
        "const lead = $input.first().json.body || $input.first().json;\n" +
        "if (!lead.leadId || lead.status !== 'cancelled') throw new Error('Invalid lead desk cancellation payload.');\n" +
        "return [{ json: { lead } }];",
    },
    position: [1520, -80],
  },
  output: [{
    lead: {
      leadId: 123,
      customerName: "Test Customer",
      customerPhone: "+16045550123",
      vehicle: "2022 Mercedes-Benz GLE 63 S AMG",
      appointmentAt: "2026-07-30T20:00:00.000Z",
      status: "cancelled",
      consentSms: true,
    },
  }],
});

const normalizeInbound = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Normalize Inbound SMS",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode:
        "const source = $input.first().json.body || $input.first().json;\n" +
        "const digits = String(source.From || '').replace(/\\D/g, '');\n" +
        "let customerPhone = '';\n" +
        "if (digits.length === 10) customerPhone = '+1' + digits;\n" +
        "else if (digits.length === 11 && digits.startsWith('1')) customerPhone = '+' + digits;\n" +
        "else if (digits.length >= 8 && digits.length <= 15) customerPhone = '+' + digits;\n" +
        "if (!customerPhone) throw new Error('Inbound SMS is missing a valid sender.');\n" +
        "const bodyOriginal = String(source.Body || '').trim();\n" +
        "return [{ json: { customerPhone, bodyOriginal, bodyUpper: bodyOriginal.toUpperCase(), messageSid: source.MessageSid || null } }];",
    },
    position: [480, 340],
  },
  output: [{
    customerPhone: "+16045550123",
    bodyOriginal: "CANCEL",
    bodyUpper: "CANCEL",
    messageSid: "SM_TEST_INBOUND",
  }],
});

const lookupLead = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Look Up Most Recent Active Lead",
    parameters: {
      method: "GET",
      url: "https://604-sell-cars-api.netlify.app/api/automation/leads/by-phone",
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
      sendQuery: true,
      specifyQuery: "keypair",
      queryParameters: {
        parameters: [{
          name: "phone",
          value: expr("{{ $json.customerPhone }}"),
        }],
      },
      options: {
        timeout: 10000,
        response: { response: { responseFormat: "json" } },
      },
    },
    credentials: {
      httpHeaderAuth: newCredential("604SellsCars Automation API"),
    },
    position: [740, 340],
  },
  output: [{
    found: true,
    lead: {
      leadId: 123,
      customerName: "Test Customer",
      customerPhone: "+16045550123",
      vehicle: "2022 Mercedes-Benz GLE 63 S AMG",
      appointmentAt: "2026-07-30T20:00:00.000Z",
      status: "booked",
      consentSms: true,
    },
  }],
});

const leadWasFound = ifElse({
  version: 2.3,
  config: {
    name: "Active Lead Found",
    parameters: {
      conditions: {
        combinator: "and",
        options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
        conditions: [{
          leftValue: expr("{{ $json.found }}"),
          rightValue: true,
          operator: { type: "boolean", operation: "true" },
        }],
      },
    },
    position: [1000, 340],
  },
});

const messageIsCancel = ifElse({
  version: 2.3,
  config: {
    name: "Message Is Exact CANCEL",
    parameters: {
      conditions: {
        combinator: "and",
        options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
        conditions: [{
          leftValue: expr("{{ $('Normalize Inbound SMS').item.json.bodyUpper }}"),
          rightValue: "CANCEL",
          operator: { type: "string", operation: "equals" },
        }],
      },
    },
    position: [1260, 260],
  },
});

const cancelLead = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Set Shared Status Cancelled",
    parameters: {
      method: "PATCH",
      url: expr("https://604-sell-cars-api.netlify.app/api/automation/leads/{{ $json.lead.leadId }}/status"),
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: { status: "cancelled" },
      options: {
        timeout: 10000,
        response: { response: { responseFormat: "json" } },
      },
    },
    credentials: {
      httpHeaderAuth: newCredential("604SellsCars Automation API"),
    },
    position: [1520, 140],
  },
  output: [{
    updated: true,
    lead: {
      leadId: 123,
      customerName: "Test Customer",
      customerPhone: "+16045550123",
      vehicle: "2022 Mercedes-Benz GLE 63 S AMG",
      appointmentAt: "2026-07-30T20:00:00.000Z",
      status: "cancelled",
      consentSms: true,
    },
  }],
});

const formatCancellation = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Format Cancelled Appointment",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode:
        "const lead = $input.first().json.lead;\n" +
        "const when = new Date(lead.appointmentAt);\n" +
        "const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', month: 'short', day: 'numeric', year: 'numeric' }).format(when);\n" +
        "const time = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', hour: 'numeric', minute: '2-digit', hour12: true }).format(when);\n" +
        "return [{ json: { ...lead, date, time } }];",
    },
    position: [1780, 140],
  },
  output: [{
    leadId: 123,
    customerName: "Test Customer",
    customerPhone: "+16045550123",
    vehicle: "2022 Mercedes-Benz GLE 63 S AMG",
    appointmentAt: "2026-07-30T20:00:00.000Z",
    status: "cancelled",
    consentSms: true,
    date: "Jul 30, 2026",
    time: "1:00 p.m.",
  }],
});

const cancelledLeadHasConsent = ifElse({
  version: 2.3,
  config: {
    name: "Cancelled Lead Has SMS Consent",
    parameters: {
      conditions: {
        combinator: "and",
        options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
        conditions: [{
          leftValue: expr("{{ $json.consentSms }}"),
          rightValue: true,
          operator: { type: "boolean", operation: "true" },
        }],
      },
    },
    position: [2040, 140],
  },
});

const sendCancelConfirmation = node({
  type: "n8n-nodes-base.twilio",
  version: 1,
  config: {
    name: "T6 Confirm Cancellation",
    parameters: {
      resource: "sms",
      operation: "send",
      from: "+17789248876",
      to: expr("{{ $json.customerPhone }}"),
      message: expr("No problem {{ $json.customerName }}, your 604SellsCars appointment for the {{ $json.vehicle }} is cancelled. Want to rebook? Head back to the site anytime."),
    },
    credentials: { twilioApi: newCredential("Twilio account") },
    position: [2300, 60],
  },
  output: [{ sid: "SM_TEST_CANCEL_CUSTOMER", status: "queued" }],
});

const sendCancelOwnerAlert = node({
  type: "n8n-nodes-base.twilio",
  version: 1,
  config: {
    name: "T7 Alert Owner Cancellation",
    parameters: {
      resource: "sms",
      operation: "send",
      from: "+17789248876",
      to: placeholder("Owner mobile number in E.164"),
      message: expr("CANCELLED: {{ $('Format Cancelled Appointment').item.json.customerName }} — {{ $('Format Cancelled Appointment').item.json.vehicle }}, was {{ $('Format Cancelled Appointment').item.json.date }} {{ $('Format Cancelled Appointment').item.json.time }}. Lead marked cancelled."),
    },
    credentials: { twilioApi: newCredential("Twilio account") },
    position: [2560, 140],
  },
  output: [{ sid: "SM_TEST_CANCEL_OWNER", status: "queued" }],
});

const forwardKnownReply = node({
  type: "n8n-nodes-base.twilio",
  version: 1,
  config: {
    name: "T8 Forward Known Reply",
    parameters: {
      resource: "sms",
      operation: "send",
      from: "+17789248876",
      to: placeholder("Owner mobile number in E.164"),
      message: expr("Reply from {{ $json.lead.customerName }} ({{ $json.lead.customerPhone }}): \"{{ $('Normalize Inbound SMS').item.json.bodyOriginal }}\""),
    },
    credentials: { twilioApi: newCredential("Twilio account") },
    position: [1520, 380],
  },
  output: [{ sid: "SM_TEST_REPLY_OWNER", status: "queued" }],
});

const forwardUnknownReply = node({
  type: "n8n-nodes-base.twilio",
  version: 1,
  config: {
    name: "T8 Forward Unknown Reply",
    parameters: {
      resource: "sms",
      operation: "send",
      from: "+17789248876",
      to: placeholder("Owner mobile number in E.164"),
      message: expr("Reply from Unknown sender ({{ $('Normalize Inbound SMS').item.json.customerPhone }}): \"{{ $('Normalize Inbound SMS').item.json.bodyOriginal }}\""),
    },
    credentials: { twilioApi: newCredential("Twilio account") },
    position: [1260, 520],
  },
  output: [{ sid: "SM_TEST_UNKNOWN_OWNER", status: "queued" }],
});

const activationNote = sticky(
  "## Cancellation and reply routing\nSet the inbound SMS production URL as the Canadian Twilio number's “A message comes in” HTTP POST target. Exact CANCEL updates the shared status. The authenticated lead-desk webhook enters the same T6/T7 notification path after a dashboard cancellation.",
  [inboundWebhook, deskCancellationWebhook, normalizeInbound, lookupLead, leadWasFound, messageIsCancel],
  { color: 5 },
);

export default workflow("604sellscars-inbound-sms", "604SellsCars — C — Inbound SMS")
  .add(activationNote)
  .add(inboundWebhook)
  .to(normalizeInbound)
  .to(lookupLead)
  .to(leadWasFound
    .onTrue(messageIsCancel
      .onTrue(cancelLead
        .to(formatCancellation)
        .to(cancelledLeadHasConsent
          .onTrue(sendCancelConfirmation.to(sendCancelOwnerAlert))
          .onFalse(sendCancelOwnerAlert)))
      .onFalse(forwardKnownReply))
    .onFalse(forwardUnknownReply))
  .add(deskCancellationWebhook)
  .to(extractDeskCancellation)
  .to(formatCancellation);
