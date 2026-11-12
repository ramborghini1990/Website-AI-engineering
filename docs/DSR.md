# DSR.md — data subject requests and retention

How a request about someone's personal data is handled, and how old data is deleted (P4.3, GDPR arts. 12, 15–22, 5(1)(e)). Engineering procedure, **not legal advice**: have it reviewed with the privacy notice (B4). What is processed and why: [ROPA.md](ROPA.md).

## 1. The clock: 30 days

- A request is answered **within one month of receipt** (art. 12(3)). This file works to **30 days** so there is margin. No fee unless the request is manifestly unfounded or excessive.
- If a request is complex or there are many, the period can be extended by up to two more months, **but the person must be told of the extension and why within the first month**.
- The clock starts the day the request arrives, not the day the identity is confirmed. Asking to verify identity does not stop it.
- A reply is always owed, including "we hold nothing about you".

## 2. Receiving and recording a request

- Channel: the privacy address (**B3: not published yet**; until then the contact form, as the draft notice says). Any email or form message that exercises a right counts, in any wording or language; no special form is required.
- Open a line in a **request register** kept outside this repository (a private spreadsheet is enough): reference number (`DSR-2026-001`), date received, type, status, due date (received + 30 days), date answered. **Do not put names, addresses or request content in the register**; the request itself stays in the mailbox. How long the register is kept: to decide with B4.
- **Identity**: reply to the address the request came from and answer there. Ask for more only if there is a real doubt (art. 12(6)), and ask for the least needed. Never send data to a different address than the one that wrote, and never act on an erasure request from an address that did not write the inquiry.
- Requests from third parties (a lawyer, a relative) need proof of authority.

## 3. Running the tool

Two commands, plain Node 24, no server:

```bash
pnpm dsr:export <email> [--out <file>]   # art. 15 access / art. 20 portability: JSON of every inquiry row for that address
pnpm dsr:delete <email> [--confirm]      # art. 17 erasure: without --confirm it only counts, with it deletes
```

They act on the database named by `DATABASE_URL`, which the tool **does not load from a file**: give it for this one command, and check the `Database host:` line it prints before you confirm anything.

```powershell
# PowerShell: the value is read from the production secret store, never typed into a file or the chat
$env:DATABASE_URL = "<production connection string>"; pnpm dsr:export person@example.com --out export.json; Remove-Item Env:DATABASE_URL
```

- The address is matched ignoring letter case and surrounding spaces, not by similarity (`a@b.it` does not match `a@b.it.test`).
- Output goes to stdout or to `--out` (a new file only, readable by you only). Messages on stderr hold **counts and instructions only**, never the address or any content. A database error is shown by its class only.
- **Consent receipts are never read or deleted** by these tools or by the purge (the code does not even reference that table; a test checks it). See §5.
- Always run the export **before** the delete, keep nothing from it beyond sending it, and delete the file after (PowerShell: `Remove-Item export.json`).

## 4. By right

| Right | What to do |
|---|---|
| Access (15) | `dsr:export`. Send the JSON (machine-readable, so it also serves portability, art. 20) to the requesting address, with: purposes, recipients and processors (the privacy notice's list), retention (each row carries `deletionDue`), the other rights, the right to complain to the Garante (garanteprivacy.it). If it holds nothing, say so. |
| Erasure (17) | `dsr:export` first if a copy was asked for, then `dsr:delete <email>` (dry run), check the count, then again with `--confirm`. Then do the **manual steps below**. Confirm to the person that it is done and what could not be erased and why. |
| Rectification (16) | No tool: correct the rows with the database provider's console (`update inquiries set … where id = '<id from the export>'`), then confirm. |
| Restriction (18) / objection (21) | No automatic processing runs on the inquiries beyond storing them and the one notification email, so in practice: stop using the data, and if asked, erase. Record the decision. |
| Withdraw marketing consent (7(3)) | Today no marketing list exists and nothing is sent from the stored flag. If a newsletter is built later, withdrawal must be applied to that list too. Record it. |
| A request quoting a **consent receipt code** | The cookie policy says a visitor can quote it. The receipt holds no identifier (random code, time, banner text version, method, calendar choice), so it cannot be tied to a person (art. 11): read it back (`select * from consent_receipts where id = '<code>'`, read-only) and tell them what it holds. Erasure is declined for it with the reason (§5); the visitor changes or withdraws the choice in the cookie preferences, which writes a new receipt. |

**Manual steps for an erasure** (the tool cannot do them):

1. The notification email of each inquiry sits in the inbox that receives them (`INQUIRY_NOTIFY_TO`): delete those messages (also from trash and archives).
2. Check the email provider's sent-mail log for the retention it applies, and note it in ROPA.md.
3. A booking made through the calendar provider is that provider's data: delete it in the Cal.com account.
4. Database **backups** keep the rows until they age out at the provider's retention period (to record once chosen, B13). Say so in the answer. If a backup is ever restored, run the purge again and re-apply every erasure received since that backup.

## 5. What is kept, and why

- **Inquiries**: erased on request, or by the scheduled purge (§6). A contract that follows is not covered by this file: invoices and accounting records live in the accounting system and follow the tax retention duty (10 years in Italy, to confirm with the accountant), not the inquiry table.
- **Consent receipts** (`consent_receipts`): kept. They are the proof that a visitor made a cookie choice (art. 7(1)); they hold no IP, no email and no other identifier, so there is nothing to look up or erase for a person, and deleting them would destroy the evidence the controller must be able to show (the basis to decline an erasure request for them is art. 17(3)(e), legal claims, to confirm with B4). Nothing in the code deletes them. **How long they are kept is not decided** (B4; the table has no purge on purpose): decide a period, then add it here, in ROPA.md and in the privacy notice.

## 6. Scheduled purge

- `vercel.json` runs `GET /api/cron/purge-expired` daily at 03:17 UTC. It deletes `inquiries` created **more than `INQUIRY_RETENTION_DAYS` (default 730, 24 months)** ago and answers `{ "purged": n, "retentionDays": 730 }`. It needs `CRON_SECRET` (Vercel sends it as a bearer token); setup: [DEPLOYMENT.md](DEPLOYMENT.md) §3.
- The clock runs from `created_at`, the only date stored. The draft notice says "24 months from the last contact": the purge can only be earlier than that, never later. **A conversation that is still going on at month 24 is cut off**: if an inquiry must outlive that (a contract is being agreed), export it (§3) and file it with the contract before the day. To align the notice with the code, reword it to "24 months from the request" at the B4 review.
- Rows are deleted by a single `delete … where created_at < now − N days`. Nothing is archived, and the log line (`cron.purge.done`) carries the count only.
- What it does **not** remove: the notification emails already sent to the inbox (delete them yourself on the same 24-month rhythm), the provider's sent-mail log, backups, and anything held by the calendar provider.
- To see what the next run will delete: `select count(*) from inquiries where created_at < now() - interval '730 days';`
- To change the period: set `INQUIRY_RETENTION_DAYS` (30–3650), redeploy, and change the privacy notice and ROPA.md in the same commit.

## 7. Open points (need the owner or a professional)

- B3: privacy address and the final retention period (730 days is a proposal).
- B4: legal review of this procedure, the 24-month figure, "from last contact" vs "from the request", retention of receipts and of the register, and art. 17(3) as the basis for keeping receipts.
- B13: name the database host and its backup retention here and in ROPA.md.
- No audit table (`data_events`, GDPR_CHECKLIST §6) exists: erasures are evidenced by the request register and the log lines only. Decide whether a table of tombstones is wanted (a hash of an address is still personal data: that is the argument against).
