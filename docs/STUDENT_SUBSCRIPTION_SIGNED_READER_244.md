## Student subscription UI — signed reader #244

The existing `/student/subscription` page is now wired exclusively to the real authenticated per-learner D1 ledger through `getSignedSubscriptionLedger`; there is no fabricated or estimated credit balance.

- A selected **live** learner sends one credential-bound no-store GET for their own identifier. Changing learner remounts the workspace, aborts the previous request and clears old learner's credit UI; signed D1 independently verifies ownership.
- A demo profile **never makes a ledger request** and cannot display a fictitious payment or subscription.
- Pending/error/denied data is never rendered as zero credit; any malformed response or `bookingEnabled:true` is rejected.
- When a real ledger returns no cycle, the page truthfully says no academic cycle is recorded, not "no payment" or "expired". Compensation totals are shown only after a successful signed read.
- Even when there is a recorded cycle, the amounts are described as **academic audit records** and **not spendable entitlement**. No purchase, renewal, checkout, booking button, price or payment status is displayed; server `bookingEnabled:false` is required.
- The original student shell, typography and card grid are reused. No new sidebar/menu pages or a mock admin panel.
- Separate required follow-ups: real staff-approved activation, exact Cairo calendar-month logic, confirmed payment/provider, concurrent paid booking/credit debit/recredit, and signed Dev acceptance before production.

Do not mistake this for financial launch. This is read-only UX after Noor `0026` foundation; billing is intentionally disabled.
