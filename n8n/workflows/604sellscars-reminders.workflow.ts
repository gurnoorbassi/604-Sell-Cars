import {
  expr,
  newCredential,
  nextBatch,
  node,
  placeholder,
  splitInBatches,
  sticky,
  switchCase,
  trigger,
  workflow,
} from "@n8n/workflow-sdk";

const reminderSchedule = trigger({
  type: "n8n-nodes-base.scheduleTrigger",
  version: 1.3,
  config: {
    name: "Every 15 Minutes",
    parameters: {
      rule: {
        interval: [{ field: "minutes", minutesInterval: 15 }],
      },
    },
    position: [220, 320],
  },
  output: [{}],
});

const fetchReminderCandidates = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Fetch Active Reminder Candidates",
    parameters: {
      method: "GET",
      url: "https://604-sell-cars-api.netlify.app/api/automation/reminders",
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
      options: {
        timeout: 10000,
        response: { response: { responseFormat: "json" } },
      },
    },
    credentials: {
      httpHeaderAuth: newCredential("604SellsCars Automation API"),
    },
    position: [480, 320],
  },
  output: [{
    leadId: 123,
    customerName: "Test Customer",
    customerPhone: "+16045550123",
    vehicle: "2022 Mercedes-Benz GLE 63 S AMG",
    appointmentAt: "2026-07-30T20:00:00.000Z",
    status: "booked",
    consentSms: true,
    reminder24hSentAt: null,
    reminder3hSentAt: null,
    reminder1hSentAt: null,
  }],
});

const determineDueStage = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Determine Earliest Due Stage",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode:
        "const now = Date.now();\n" +
        "const active = new Set(['new', 'assigned', 'booked']);\n" +
        "const output = [];\n" +
        "for (const item of $input.all()) {\n" +
        "  const lead = item.json;\n" +
        "  const appointment = new Date(lead.appointmentAt);\n" +
        "  const appointmentMs = appointment.getTime();\n" +
        "  if (!active.has(lead.status) || lead.consentSms !== true || !Number.isFinite(appointmentMs) || appointmentMs <= now) continue;\n" +
        "  let stage = null;\n" +
        "  if (!lead.reminder24hSentAt && now >= appointmentMs - 24 * 60 * 60 * 1000) stage = '24h';\n" +
        "  else if (!lead.reminder3hSentAt && now >= appointmentMs - 3 * 60 * 60 * 1000) stage = '3h';\n" +
        "  else if (!lead.reminder1hSentAt && now >= appointmentMs - 60 * 60 * 1000) stage = '1h';\n" +
        "  if (!stage) continue;\n" +
        "  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', month: 'short', day: 'numeric', year: 'numeric' }).format(appointment);\n" +
        "  const time = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', hour: 'numeric', minute: '2-digit', hour12: true }).format(appointment);\n" +
        "  output.push({ json: { ...lead, stage, date, time } });\n" +
        "}\n" +
        "return output;",
    },
    position: [740, 320],
  },
  output: [{
    leadId: 123,
    customerName: "Test Customer",
    customerPhone: "+16045550123",
    vehicle: "2022 Mercedes-Benz GLE 63 S AMG",
    appointmentAt: "2026-07-30T20:00:00.000Z",
    status: "booked",
    consentSms: true,
    stage: "24h",
    date: "Jul 30, 2026",
    time: "1:00 p.m.",
  }],
});

const reminderLoop = splitInBatches({
  version: 3,
  config: {
    name: "Send One Reminder at a Time",
    parameters: { batchSize: 1 },
    position: [1000, 320],
  },
});

const routeReminderStage = switchCase({
  version: 3.4,
  config: {
    name: "Route 24h 3h 1h",
    parameters: {
      mode: "rules",
      rules: {
        values: [
          {
            conditions: {
              combinator: "and",
              options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
              conditions: [{
                leftValue: expr("{{ $json.stage }}"),
                rightValue: "24h",
                operator: { type: "string", operation: "equals" },
              }],
            },
            renameOutput: true,
            outputKey: "24h",
          },
          {
            conditions: {
              combinator: "and",
              options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
              conditions: [{
                leftValue: expr("{{ $json.stage }}"),
                rightValue: "3h",
                operator: { type: "string", operation: "equals" },
              }],
            },
            renameOutput: true,
            outputKey: "3h",
          },
          {
            conditions: {
              combinator: "and",
              options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
              conditions: [{
                leftValue: expr("{{ $json.stage }}"),
                rightValue: "1h",
                operator: { type: "string", operation: "equals" },
              }],
            },
            renameOutput: true,
            outputKey: "1h",
          },
        ],
      },
    },
    position: [1240, 320],
  },
});

const send24hReminder = node({
  type: "n8n-nodes-base.twilio",
  version: 1,
  config: {
    name: "T3 Send 24h Reminder",
    parameters: {
      resource: "sms",
      operation: "send",
      from: "+17789248876",
      to: expr("{{ $json.customerPhone }}"),
      message: expr("Hi {{ $json.customerName }}, reminder: your 604SellsCars appointment for the {{ $json.vehicle }} is tomorrow, {{ $json.date }} at {{ $json.time }}. See you then! Reply CANCEL if you can't make it."),
    },
    credentials: { twilioApi: newCredential("Twilio account") },
    position: [1500, 120],
  },
  output: [{ sid: "SM_TEST_24H", status: "queued" }],
});

const send3hReminder = node({
  type: "n8n-nodes-base.twilio",
  version: 1,
  config: {
    name: "T4 Send 3h Reminder",
    parameters: {
      resource: "sms",
      operation: "send",
      from: "+17789248876",
      to: expr("{{ $json.customerPhone }}"),
      message: expr("Hi {{ $json.customerName }}, your 604SellsCars appointment for the {{ $json.vehicle }} is today at {{ $json.time }} — about 3 hours away. Reply CANCEL if anything's changed."),
    },
    credentials: { twilioApi: newCredential("Twilio account") },
    position: [1500, 320],
  },
  output: [{ sid: "SM_TEST_3H", status: "queued" }],
});

const send1hReminder = node({
  type: "n8n-nodes-base.twilio",
  version: 1,
  config: {
    name: "T5 Send 1h Reminder",
    parameters: {
      resource: "sms",
      operation: "send",
      from: "+17789248876",
      to: expr("{{ $json.customerPhone }}"),
      message: expr("Hi {{ $json.customerName }}, see you soon — your {{ $json.vehicle }} appointment is in about an hour ({{ $json.time }}). Reply CANCEL if you can't make it."),
    },
    credentials: { twilioApi: newCredential("Twilio account") },
    position: [1500, 520],
  },
  output: [{ sid: "SM_TEST_1H", status: "queued" }],
});

const mark24hSent = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Mark 24h Sent",
    parameters: {
      method: "PATCH",
      url: expr("https://604-sell-cars-api.netlify.app/api/automation/leads/{{ $('Determine Earliest Due Stage').item.json.leadId }}/reminders/24h"),
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
      options: {
        timeout: 10000,
        response: { response: { responseFormat: "json" } },
      },
    },
    credentials: {
      httpHeaderAuth: newCredential("604SellsCars Automation API"),
    },
    position: [1760, 120],
  },
  output: [{ updated: true, leadId: 123, stage: "24h" }],
});

const mark3hSent = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Mark 3h Sent",
    parameters: {
      method: "PATCH",
      url: expr("https://604-sell-cars-api.netlify.app/api/automation/leads/{{ $('Determine Earliest Due Stage').item.json.leadId }}/reminders/3h"),
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
      options: {
        timeout: 10000,
        response: { response: { responseFormat: "json" } },
      },
    },
    credentials: {
      httpHeaderAuth: newCredential("604SellsCars Automation API"),
    },
    position: [1760, 320],
  },
  output: [{ updated: true, leadId: 123, stage: "3h" }],
});

const mark1hSent = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Mark 1h Sent",
    parameters: {
      method: "PATCH",
      url: expr("https://604-sell-cars-api.netlify.app/api/automation/leads/{{ $('Determine Earliest Due Stage').item.json.leadId }}/reminders/1h"),
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
      options: {
        timeout: 10000,
        response: { response: { responseFormat: "json" } },
      },
    },
    credentials: {
      httpHeaderAuth: newCredential("604SellsCars Automation API"),
    },
    position: [1760, 520],
  },
  output: [{ updated: true, leadId: 123, stage: "1h" }],
});

const activationNote = sticky(
  "## Polling reminder engine\nRuns every 15 minutes. It queries only active, consenting leads; skips passed appointments; emits one earliest un-sent stage per lead; sends one item at a time; and marks the matching timestamp only after Twilio accepts the message.",
  [reminderSchedule, fetchReminderCandidates, determineDueStage, reminderLoop, routeReminderStage],
  { color: 5 },
);

export default workflow("604sellscars-reminders", "604SellsCars — B — Reminder Engine")
  .add(activationNote)
  .add(reminderSchedule)
  .to(fetchReminderCandidates)
  .to(determineDueStage)
  .to(reminderLoop.onEachBatch(
    routeReminderStage
      .onCase(0, send24hReminder.to(mark24hSent.to(nextBatch(reminderLoop))))
      .onCase(1, send3hReminder.to(mark3hSent.to(nextBatch(reminderLoop))))
      .onCase(2, send1hReminder.to(mark1hSent.to(nextBatch(reminderLoop)))),
  ));
