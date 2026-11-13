# INCIDENTS.md — personal data breach procedure (draft, P4.7)

**Draft.** This is an operating note, not legal advice. Have a qualified professional (lawyer or DPO) review it before launch (B4, [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) §6). Article numbers are GDPR; check them and the Garante's current procedure when you review.

## What counts

A personal data breach is a security incident that leads to the accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to, personal data (art. 4(12)). Examples here: someone reads the `inquiries` table; a database backup or an environment variable leaks; the notification email goes to the wrong person; a deployment exposes server logs with personal data.

What the site holds (details in [ROPA.md](ROPA.md)): **inquiries** (name, business email, message, optional company, budget band, timeline) in the EU Postgres; **consent receipts** (random id, choices, policy version, timestamp, user-agent family; no IP, no account link); **rate-limit counters** in Upstash (salted IP hashes, short-lived); emails in your mailbox and the email provider. Logs carry no bodies, names or raw IPs ([SECURITY.md](SECURITY.md)).

## Who decides

The controller: you. Name the decision-maker and a deputy here before launch: ______ / ______. A processor that finds a breach must tell the controller without undue delay (art. 33(2)); keep their security contacts in §5.

## The clock

The 72 hours (art. 33(1)) run from the moment you become **aware** that a breach happened, not from when it started. Unless the breach is unlikely to result in a risk to people's rights and freedoms, notify the Garante within 72 hours; if you are late, say why. If you cannot yet know everything, notify in phases. Write down the moment of awareness first.

## Steps

1. **Contain (first hour).** Stop the leak: rotate the exposed secret (Vercel variable, database credential, Upstash token, email API key, `CRON_SECRET`, `RATE_LIMIT_IP_SALT`), revoke sessions or tokens in the affected account, roll back or pause the deployment in Vercel, take the form offline by removing a required form variable (the page then shows "the form is not available"). Do not delete evidence: keep logs and the deployment.
2. **Record.** Open an entry in the log below at once: time of awareness, who found it, what you know.
3. **Assess.** Which data, how many people, since when, was it read or only exposed, is it encrypted or hashed (consent receipts and counters hold no direct identifiers; inquiries do), what harm is plausible (spam and phishing against business contacts; identity risk is low, but the message text is free and may hold anything).
4. **Decide.** Notify the Garante unless you can show the breach is unlikely to cause a risk; write the reasoning either way (art. 33(5): every breach is documented, including those not notified).
5. **Notify the Garante** through its online breach-notification service (find the current page on garanteprivacy.it; its address is not recorded here because it has not been checked). Content: nature of the breach, categories and approximate numbers of people and records, contact for more information, likely consequences, measures taken or proposed (art. 33(3)).
6. **Tell the people affected without undue delay** if the breach is likely to result in a **high** risk (art. 34): in plain language, what happened, what it may mean for them, what you did, whom to contact. Use the email they gave you; do not use a channel that adds exposure.
7. **Fix and learn.** Root cause, permanent fix, a test that would have caught it, update [SECURITY.md](SECURITY.md), the ROPA and this file. Close the log entry.

## Contacts to fill in before launch

| Who | Contact | Notes |
|---|---|---|
| Garante (breach notification) | online service on garanteprivacy.it | bookmark the page; verify it at review |
| Vercel | security / support channel of your plan | hosting, logs, deployments |
| Database provider | | EU Postgres |
| Upstash | | rate-limit counters |
| Email provider (Resend) | | notification emails |
| Cloudflare (Turnstile) | | bot check |
| Your lawyer / DPO | | |

## Breach log (art. 33(5))

Copy one row per incident, also for those not notified. Keep the log in a private place, not in the public repo: it may name people.

| Field | Entry |
|---|---|
| Reference / date opened | |
| Time of awareness (T0) | |
| Found by / how | |
| What happened | |
| Data and categories affected; number of people / records | |
| Likely consequences | |
| Containment and when | |
| Garante notified? when? why / why not | |
| People informed? when? why / why not | |
| Cause and permanent fix | |
| Closed on | |
