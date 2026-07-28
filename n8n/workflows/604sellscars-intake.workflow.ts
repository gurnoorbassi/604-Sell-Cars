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

const intakeWebhook = trigger({
  type: "n8n-nodes-base.webhook",
  version: 2.1,
  config: {
    name: "Receive Canonical Booking",
    parameters: {
      httpMethod: "POST",
      path: "604sellscars-booking-intake",
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
    position: [240, 300],
  },
  output: [{
    headers: { "x-604sc-automation-key": "configured-in-credential" },
    body: {
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

const formatIntake = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Format Pacific Appointment",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode:
        "const source = $input.first().json.body || $input.first().json;\n" +
        "const when = new Date(source.appointmentAt);\n" +
        "if (!source.leadId || !source.customerName || !source.customerPhone || !source.vehicle || Number.isNaN(when.getTime())) throw new Error('Invalid canonical booking payload.');\n" +
        "const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', month: 'short', day: 'numeric', year: 'numeric' }).format(when);\n" +
        "const time = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', hour: 'numeric', minute: '2-digit', hour12: true }).format(when);\n" +
        "return [{ json: { ...source, consentSms: source.consentSms === true, date, time } }];",
    },
    position: [500, 300],
  },
  output: [{
    leadId: 123,
    customerName: "Test Customer",
    customerPhone: "+16045550123",
    vehicle: "2022 Mercedes-Benz GLE 63 S AMG",
    appointmentAt: "2026-07-30T20:00:00.000Z",
    status: "booked",
    consentSms: true,
    date: "Jul 30, 2026",
    time: "1:00 p.m.",
  }],
});

const hasSmsConsent = ifElse({
  version: 2.3,
  config: {
    name: "Customer Gave SMS Consent",
    parameters: {
      conditions: {
        combinator: "and",
        options: {
          caseSensitive: true,
          leftValue: "",
          typeValidation: "strict",
          version: 2,
        },
        conditions: [{
          leftValue: expr("{{ $json.consentSms }}"),
          rightValue: true,
          operator: { type: "boolean", operation: "true", singleValue: true },
        }],
      },
    },
    position: [760, 300],
  },
});

const sendCustomerConfirmation = node({
  type: "n8n-nodes-base.twilio",
  version: 1,
  config: {
    name: "T1 Send Booking Confirmation",
    parameters: {
      resource: "sms",
      operation: "send",
      from: "+17789248876",
      to: expr("{{ $json.customerPhone }}"),
      message: expr("Hi {{ $json.customerName }}, you're booked with 604SellsCars for the {{ $json.vehicle }} on {{ $json.date }} at {{ $json.time }}. One of our team will reach out shortly to get you set up. Need to cancel? Just reply CANCEL. Reply STOP to opt out."),
    },
    credentials: {
      twilioApi: newCredential("Twilio account"),
    },
    position: [1020, 220],
  },
  output: [{ sid: "SM_TEST_CONFIRMATION", status: "queued", to: "+16045550123" }],
});

const sendOwnerAlert = node({
  type: "n8n-nodes-base.twilio",
  version: 1,
  config: {
    name: "T2 Alert Owner",
    parameters: {
      resource: "sms",
      operation: "send",
      from: "+17789248876",
      to: placeholder("Owner mobile number in E.164"),
      message: expr("New lead: {{ $('Format Pacific Appointment').item.json.customerName }} — {{ $('Format Pacific Appointment').item.json.vehicle }}. Appt {{ $('Format Pacific Appointment').item.json.date }} {{ $('Format Pacific Appointment').item.json.time }}. Phone {{ $('Format Pacific Appointment').item.json.customerPhone }}. Assign a rep."),
    },
    credentials: {
      twilioApi: newCredential("Twilio account"),
    },
    position: [1280, 300],
  },
  output: [{ sid: "SM_TEST_OWNER", status: "queued" }],
});

const activationNote = sticky(
  "## Activation gate\nKeep this workflow inactive until the Twilio credential, Canadian sender number, owner number, and Header Auth credential are configured. The lead API calls this webhook only after the canonical Supabase write succeeds.",
  [intakeWebhook, formatIntake, hasSmsConsent, sendCustomerConfirmation, sendOwnerAlert],
  { color: 5 },
);

export default workflow("604sellscars-intake", "604SellsCars — A — Booking Intake")
  .add(activationNote)
  .add(intakeWebhook)
  .to(formatIntake)
  .to(hasSmsConsent
    .onTrue(sendCustomerConfirmation.to(sendOwnerAlert))
    .onFalse(sendOwnerAlert));
