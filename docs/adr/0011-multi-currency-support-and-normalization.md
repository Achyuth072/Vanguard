# ADR 0011: Multi-Currency Support and Salary Normalization
 
 ## Context
 
 Candidate profiles and imported job postings operate in diverse currencies (primarily INR for domestic roles, and USD/EUR/GBP for foreign or remote international roles). Previously, `minSalary` on Candidate and `salaryMin`/`salaryMax` on Job were bare numeric scalars without currency metadata, while deterministic filtering and UI formatting hardcoded USD (`$`).
 
 Direct numeric comparisons between different currencies (e.g. comparing ₹1,500,000 INR with $100,000 USD) caused false rejections or incorrect filtering in deterministic gating.
 
 ## Decision
 
 1. **Schema & Types**: Add an ISO-4217 `currency` string field to both `Candidate` (defaulting to `"INR"`) and `Job` (defaulting to `"INR"`).
 2. **Ingestion & Parsing**: Update the AI ingestion prompt to detect currency symbols/codes (`₹`, `INR`, `Rs`, `LPA`, `$`, `USD`, `€`, `EUR`, `£`, `GBP`) and normalize Indian denominations (e.g., converting "15 LPA" to `1500000` with currency `INR`). Unstated currencies fall back to the candidate's preferred currency (`INR`).
 3. **Deterministic Filtering**:
    - If job currency matches candidate currency, perform direct numeric comparison (`job.salaryMax < candidate.minSalary`).
    - If currencies differ, convert the job salary using a static exchange rate map (e.g., 1 USD = 85 INR, 1 EUR = 92 INR, 1 GBP = 110 INR, 1 CAD = 62 INR, 1 AUD = 55 INR, 1 SGD = 63 INR). If currency is unmapped, bypass the hard gate to allow AI fit scoring to evaluate compensation.
 4. **UI & Formatting**: Implement a centralized `formatSalary(amount, currency)` helper utilizing `Intl.NumberFormat` with appropriate locale (`en-IN` for INR, `en-US` for USD/foreign currencies). Add currency selector dropdowns to the Profile Drawer and Job Edit Modal.
 
 ## Consequences
 
 - Accurate compensation filtering without rejecting foreign currency opportunities.
 - Zero external API overhead: FX normalization uses static exchange constants suitable for threshold gating.
 - Candidate profile defaults to INR while seamlessly supporting multi-currency roles.
