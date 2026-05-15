export type WorkflowType = "assistant";

export interface BuiltInWorkflow {
  id: string;
  title: string;
  type: WorkflowType;
  practice: string;
  prompt: string | null;
  columnsConfig?: null;
}

export const BUILT_IN_WORKFLOWS: BuiltInWorkflow[] = [
  {
    id: "builtin-cp-checklist",
    title: "Generate CP Checklist",
    type: "assistant",
    practice: "General Transactions",
    prompt: "## Generate Conditions Precedent Checklist\n\nReview the uploaded credit agreement or financing document and generate a comprehensive Conditions Precedent (CP) checklist.\n\nYou MUST use the generate_docx tool to produce the checklist as a downloadable Word document. You MUST pass landscape: true to the generate_docx tool — the document must be in landscape orientation. Do not display the checklist inline — generate the .docx file and provide the download link.\n\nStructure the document as follows:\n- For each category of conditions (e.g. Corporate, Financial, Legal, Security), add a section with a heading\n- Under each category heading, include a table with exactly these four columns in this order:\n  1. Index — sequential number within the category (1, 2, 3…)\n  2. Clause Number — the clause or schedule reference from the agreement\n  3. Clause — a concise description of the condition precedent\n  4. Status — leave blank (empty string) for the user to fill in\n\nUse the table field in the section object (not content) for each category's rows.",
    columnsConfig: null
  },
  {
    id: "builtin-credit-summary",
    title: "Credit Agreement Summary",
    type: "assistant",
    practice: "Finance",
    prompt: "## Credit Agreement Summary\n\nReview the uploaded credit agreement and produce a comprehensive legal summary covering the following topics. For each section, identify the key provisions, quote the relevant clause or schedule references, and flag any unusual, onerous, or non-market terms.\n\n1. **Lenders** — All lenders or members of the lender syndicate, including their full legal name and role (e.g. mandated lead arranger, original lender, agent bank)\n2. **Borrowers** — All borrowers, including their full legal name and jurisdiction of incorporation\n3. **Guarantors** — All guarantors, including their full legal name and the scope of their guarantee obligation\n4. **Other Parties** — Any other material parties (e.g. facility agent, security agent, hedge counterparties, issuing bank) and their roles\n5. **Date of Agreement** — Date of the credit agreement\n6. **Facilities** — Each facility available (e.g. Revolving Credit Facility, Term Loan A, Term Loan B, Term Loan C), the facility type, tranche name, and any key structural features\n7. **Amount** — Total committed amount across all facilities, the currency, and breakdown by tranche if applicable\n8. **Purpose** — Stated purpose for which borrowings may be used and any restrictions on use of proceeds\n9. **Interest** — Applicable reference rate (e.g. SOFR, EURIBOR, base rate), the margin, any margin ratchet mechanism, and how interest periods are structured\n10. **Commitment Fee** — Commitment or utilisation fees, the applicable rate, how they are calculated, and the basis (e.g. undrawn commitment, average utilisation)\n11. **Repayment Schedule** — Repayment profile for each facility, whether by scheduled instalments or bullet repayment, and the repayment dates and amounts\n12. **Maturity** — Final maturity date for each facility\n13. **Security** — Each class of security granted or required (e.g. share pledges, fixed and floating charges, real estate mortgages, account pledges) and the assets or entities over which security is taken\n14. **Guarantees** — Guarantee obligations, the guarantors, the scope of the guarantee, and any limitations (e.g. up-stream guarantee limitations, guarantor coverage test)\n15. **Financial Covenants** — Each financial covenant, the metric (e.g. leverage ratio, interest cover, cashflow cover), the applicable test, testing frequency, and any equity cure rights\n16. **Events of Default** — Each event of default, noting any grace periods, materiality thresholds, or cross-default provisions\n17. **Assignment** — Restrictions or permissions on assignment or transfer (e.g. white/blacklists, borrower consent for lender transfers; restrictions on borrower assignment)\n18. **Change of Control** — What constitutes a change of control, what obligations it triggers (e.g. mandatory prepayment, cancellation, lender consent), and any cure period\n19. **Prepayment Fee** — Any prepayment fees, make-whole premiums, or soft-call protections, the applicable fee, the period during which it applies, and any exceptions (e.g. prepayment from insurance proceeds or asset disposals)\n20. **Governing Law** — Governing law of the agreement\n21. **Dispute Resolution** — Whether disputes go to litigation or arbitration, the chosen forum or seat, and any submission to jurisdiction provisions\n\nDeliver the summary inline in your chat response — do NOT call generate_docx. Only produce a downloadable Word document if the user explicitly asks for one.",
    columnsConfig: null
  },
  {
    id: "builtin-sha-summary",
    title: "Shareholder Agreement Summary",
    type: "assistant",
    practice: "Corporate",
    prompt: "## Shareholder Agreement Summary\n\nReview the uploaded shareholder agreement and produce a comprehensive legal summary covering the following topics. For each section, identify the key provisions, quote the relevant clause references, and flag any unusual, onerous, or market-standard deviations.\n\n1. **Parties & Shareholdings** — Full legal names, roles, share classes held, and percentage interests (on a fully diluted basis if stated)\n2. **Share Classes & Rights** — For each class: voting rights, dividend rights, liquidation preference, conversion or redemption features\n3. **Board Composition & Governance** — Board size, director appointment rights (and the shareholding thresholds required to maintain them), quorum, and casting vote\n4. **Reserved Matters** — Decisions requiring a special majority, unanimity, or a specific shareholder's consent; note the threshold and whose consent is required for each\n5. **Pre-emption on New Shares** — Who holds pre-emption rights, procedure, timeline, and any carve-outs (e.g. employee option schemes)\n6. **Transfer Restrictions** — Lock-up periods, prohibited transfers, permitted transfers (e.g. to affiliates), and any board or shareholder approval requirements\n7. **Right of First Refusal / Pre-emption on Transfer** — Trigger, procedure, pricing mechanics, and any exceptions\n8. **Drag-Along Rights** — Who holds the right, threshold to trigger, conditions (e.g. minimum price, independent valuation), and minority protections\n9. **Tag-Along Rights** — Who holds the right, triggering threshold, exercise procedure, and price terms\n10. **Anti-Dilution Protections** — Type (full ratchet, weighted average), trigger events, calculation mechanics, and exceptions\n11. **Dividend Policy** — Any obligation or target to pay dividends, preferential dividend rights, and restrictions on distributions\n12. **Exit & Liquidity** — Agreed exit routes (trade sale, IPO, drag sale), timelines, and liquidation preferences on exit\n13. **Deadlock** — Deadlock definition, escalation and resolution mechanisms (e.g. Russian roulette, put/call options), and consequences if unresolved\n14. **Non-Compete & Non-Solicitation** — Who is bound, scope of activities and geography, duration, and carve-outs\n15. **Governing Law & Dispute Resolution** — Applicable law, forum, arbitration or litigation, and any mandatory escalation steps\n\nGenerate the summary as a downloadable Word document.",
    columnsConfig: null
  },
  {
    id: "builtin-nda-review",
    title: "NDA Review",
    type: "assistant",
    practice: "General Transactions",
    prompt: "## NDA Review\n\nReview the uploaded NDA and identify the commercial and legal issues that matter most to the receiving or disclosing party. Use clause references where available and explain the practical effect of each issue.\n\nAnalyze:\n- Parties and their respective confidentiality obligations\n- Confidentiality scope, exclusions, and permitted disclosures\n- Term, survival period, return or destruction obligations\n- Remedies for breach, injunctive relief, and damages limitations\n- Jurisdiction, governing law, and dispute forum\n\nOutput format:\n1. **Executive Summary** — concise overall assessment\n2. **Key Obligations** — party-by-party summary\n3. **Risk Issues** — table with Clause / Issue / Risk Rating (HIGH, MEDIUM, LOW) / Practical Impact / Suggested Revision\n4. **Negotiation Points** — prioritized list of changes to request\n\nFlag any HIGH risk clauses clearly.",
    columnsConfig: null
  },
  {
    id: "builtin-employment-agreement-review",
    title: "Employment Agreement Review",
    type: "assistant",
    practice: "Employment",
    prompt: "## Employment Agreement Review\n\nReview the employment agreement from the perspective requested by the user. Identify provisions that are unusually favorable to the employer or materially restrictive for the employee.\n\nAnalyze:\n- Compensation, bonus, equity, benefits, and expense reimbursement\n- Non-compete, non-solicitation, confidentiality, and restraint provisions\n- IP assignment, inventions, moral rights, and work-product ownership\n- Termination rights, notice, severance, garden leave, and cause definitions\n- Governing law, forum, dispute resolution, and statutory compliance issues\n\nOutput format:\n1. **Overall Risk Rating** — HIGH, MEDIUM, or LOW with a short rationale\n2. **Commercial Summary** — key economics and obligations\n3. **Employer-Favorable Terms** — table with Clause / Issue / Risk Rating / Why It Matters / Proposed Revision\n4. **Negotiation Checklist** — prioritized asks before signing.",
    columnsConfig: null
  },
  {
    id: "builtin-spa-review",
    title: "SPA Review",
    type: "assistant",
    practice: "Corporate",
    prompt: "## SPA Review\n\nReview the Share Purchase Agreement and identify transaction risks, missing protections, and negotiation points. Quote clause references where available.\n\nAnalyze:\n- Purchase price, adjustments, leakage, locked-box or completion accounts mechanics\n- Representations and warranties, disclosure standards, and knowledge qualifiers\n- Conditions to closing and termination rights\n- Indemnification, caps, baskets, survival periods, exclusions, and procedures\n- Restrictive covenants, non-competes, confidentiality, and interim operating covenants\n\nOutput format:\n1. **Deal Snapshot** — parties, structure, consideration, closing mechanics\n2. **Key Protections Present** — concise list\n3. **Missing or Weak Protections** — table with Issue / Risk Rating (HIGH, MEDIUM, LOW) / Buyer or Seller Impact / Suggested Drafting\n4. **Negotiation Priorities** — highest-value changes to request.",
    columnsConfig: null
  },
  {
    id: "builtin-commercial-lease-review",
    title: "Commercial Lease Review",
    type: "assistant",
    practice: "Real Estate",
    prompt: "## Commercial Lease Review\n\nReview the commercial lease and identify tenant-unfavorable terms, operational constraints, and financial exposure. Use clause references where available.\n\nAnalyze:\n- Base rent, escalation, service charges, taxes, deposits, and payment defaults\n- Permitted use, exclusivity, operating covenants, and compliance obligations\n- Maintenance, repair, insurance, indemnity, and casualty obligations\n- Assignment, subletting, change of control, and consent standards\n- Term, renewal, termination, relocation, and restoration obligations\n\nOutput format:\n1. **Lease Snapshot** — premises, term, rent, parties, and purpose\n2. **Tenant-Unfavorable Terms** — table with Clause / Issue / Risk Rating (HIGH, MEDIUM, LOW) / Practical Impact / Proposed Change\n3. **Operational Restrictions** — constraints that may affect business use\n4. **Negotiation Checklist** — prioritized tenant asks.",
    columnsConfig: null
  },
  {
    id: "builtin-legal-research-summary",
    title: "Legal Research Summary",
    type: "assistant",
    practice: "General",
    prompt: "## Legal Research Summary\n\nResearch the legal question provided by the user and produce a practical research memorandum. If jurisdiction is unclear, state the assumption and ask for clarification only if necessary.\n\nStructure the response exactly as:\n1. **Legal Question** — precise formulation of the issue\n2. **Applicable Law** — statutes, regulations, doctrines, and legal tests\n3. **Key Cases** — leading authorities with concise relevance notes\n4. **Current Position** — balanced summary of the likely legal answer\n5. **Practical Implications** — recommended next steps, evidence needed, and risk rating where appropriate\n\nUse clear citations where possible. Distinguish settled law from uncertain or developing law.",
    columnsConfig: null
  },
  {
    id: "builtin-contract-clause-drafter",
    title: "Contract Clause Drafter",
    type: "assistant",
    practice: "General Transactions",
    prompt: "## Contract Clause Drafter\n\nDraft the contract clause specified by the user. Confirm the commercial objective from the prompt and draft in a clean, ready-to-use style.\n\nProvide:\n1. **Standard Version** — balanced market wording\n2. **Client-Favorable Version** — wording that protects the user's stated position\n3. **Counterparty-Favorable Version** — wording likely preferred by the other side\n4. **Negotiation Points** — table with Issue / Preferred Position / Fallback Position / Risk Rating (HIGH, MEDIUM, LOW)\n\nUse precise legal terminology, avoid unnecessary complexity, and include bracketed placeholders for deal-specific facts.",
    columnsConfig: null
  },
  {
    id: "builtin-demand-letter",
    title: "Demand Letter",
    type: "assistant",
    practice: "Litigation",
    prompt: "## Demand Letter\n\nDraft a professional demand letter based on the facts provided by the user. Use a firm, credible, and commercially sensible tone.\n\nInclude:\n- Date, parties, and subject line placeholders where information is missing\n- Clear factual background in chronological order\n- Legal basis for the claim and key supporting facts\n- Specific demand, amount or action required, and deadline\n- Consequences of non-compliance without overstating threats\n- Reservation of rights\n\nOutput the letter in ready-to-send format. After the letter, add a short **Drafting Notes** section identifying assumptions, missing facts, and any HIGH / MEDIUM / LOW litigation risks.",
    columnsConfig: null
  },
  {
    id: "builtin-legal-opinion-summary",
    title: "Legal Opinion Summary",
    type: "assistant",
    practice: "General",
    prompt: "## Legal Opinion Summary\n\nSummarize the legal opinion or document provided in plain English for a business or client audience. Preserve legal precision while avoiding unnecessary jargon.\n\nStructure the output as:\n1. **Key Conclusions** — main holdings or advice\n2. **Supporting Analysis** — reasoning, authorities, and factual assumptions\n3. **Important Caveats** — qualifications, limitations, and dependencies\n4. **Practical Recommendations** — actions the reader should consider\n\nFlag any unresolved legal uncertainty or implementation risk using HIGH / MEDIUM / LOW ratings where relevant.",
    columnsConfig: null
  },
  {
    id: "builtin-pdpa-compliance-check",
    title: "PDPA Compliance Check",
    type: "assistant",
    practice: "Privacy",
    prompt: "## PDPA Compliance Check\n\nReview the provided document, policy, or process against Singapore's Personal Data Protection Act (PDPA). Focus on practical compliance gaps and remediation steps.\n\nCheck:\n- Consent collection, deemed consent, withdrawal of consent, and notification\n- Purpose limitation and reasonableness of collection, use, and disclosure\n- Access, correction, retention limitation, and data accuracy obligations\n- Protection obligations, transfer restrictions, and vendor handling\n- Breach notification and accountability requirements\n\nOutput format:\n1. **Compliance Snapshot** — overall status and risk rating\n2. **Findings Table** — Requirement / Observation / Risk Rating (HIGH, MEDIUM, LOW) / Recommended Fix\n3. **Priority Remediation Plan** — immediate, near-term, and longer-term actions.",
    columnsConfig: null
  },
  {
    id: "builtin-gdpr-compliance-check",
    title: "GDPR Compliance Check",
    type: "assistant",
    practice: "Privacy",
    prompt: "## GDPR Compliance Check\n\nReview the document, policy, or processing activity against GDPR requirements. Identify compliance gaps and practical remediation steps.\n\nCheck:\n- Lawful basis for processing and special category data issues\n- Data subject rights, response timelines, and operational procedures\n- Privacy notice adequacy, transparency, retention, and minimization\n- Controller / processor allocation and DPA requirements\n- International transfer mechanisms, SCCs, TIAs, and subprocessors\n\nOutput format:\n1. **Overall GDPR Risk** — HIGH, MEDIUM, or LOW\n2. **Gap Analysis** — table with GDPR Area / Issue / Risk Rating / Required Action\n3. **Documentation Needed** — records, policies, notices, and contracts to update\n4. **Priority Actions** — ranked remediation steps.",
    columnsConfig: null
  },
  {
    id: "builtin-privacy-policy-review",
    title: "Privacy Policy Review",
    type: "assistant",
    practice: "Privacy",
    prompt: "## Privacy Policy Review\n\nReview the privacy policy for clarity, completeness, and legal risk. Assume the policy should be understandable to users and defensible for compliance purposes.\n\nIdentify:\n- Missing required disclosures or unclear controller/contact information\n- Vague, overly broad, or unsupported data collection language\n- Inadequate user rights, choices, retention, or deletion provisions\n- Third-party sharing, analytics, advertising, and cross-border transfer risks\n- Security, children's data, and policy update issues\n\nOutput format:\n1. **Plain-English Summary**\n2. **Issues Table** — Section / Issue / Risk Rating (HIGH, MEDIUM, LOW) / Recommended Text\n3. **Priority Improvements** — specific changes to make first.",
    columnsConfig: null
  },
  {
    id: "builtin-chronology-builder",
    title: "Chronology Builder",
    type: "assistant",
    practice: "Litigation",
    prompt: "## Chronology Builder\n\nExtract all dates, events, communications, and actions from the uploaded document or facts provided. Build a clean litigation-ready chronology.\n\nOutput as a table with exactly these columns:\n| Date | Event | Parties Involved | Source / Reference | Significance |\n\nInstructions:\n- Use exact dates where available and mark uncertain dates as approximate\n- Preserve source references, document titles, page numbers, or clause references where possible\n- Flag key dates relevant to limitation periods, notice deadlines, filing deadlines, or contractual time bars\n- After the table, add **Limitation / Deadline Risks** with HIGH / MEDIUM / LOW ratings for critical dates.",
    columnsConfig: null
  },
  {
    id: "builtin-deposition-prep",
    title: "Deposition Prep",
    type: "assistant",
    practice: "Litigation",
    prompt: "## Deposition Prep\n\nBased on the documents and facts provided, generate comprehensive deposition questions for the witness identified by the user. Tailor questions to the witness's role and likely knowledge.\n\nOrganize by topic:\n1. **Background and Role**\n2. **Document Authentication**\n3. **Key Facts and Timeline**\n4. **Communications and Knowledge**\n5. **Damages, Causation, or Reliance**\n6. **Impeachment / Inconsistency Questions**\n\nFor each topic, provide primary questions and follow-up questions. Flag sensitive or high-risk lines of questioning with HIGH / MEDIUM / LOW risk ratings and explain why.",
    columnsConfig: null
  },
  {
    id: "builtin-brief-section-drafter",
    title: "Brief Section Drafter",
    type: "assistant",
    practice: "Litigation",
    prompt: "## Brief Section Drafter\n\nDraft the specified brief section based on the facts, record references, and legal arguments provided by the user. Use formal legal writing and a clear advocacy structure.\n\nFollow this structure unless the user requests otherwise:\n1. **Statement of Facts** — concise, record-supported facts\n2. **Legal Standard** — governing test with citation placeholders if needed\n3. **Argument** — point headings, application of law to facts, and rebuttal of likely counterarguments\n4. **Conclusion** — requested relief or finding\n\nUse citation placeholders in proper legal format where exact authorities are missing. Flag weak arguments, evidentiary gaps, or adverse authority risks using HIGH / MEDIUM / LOW ratings.",
    columnsConfig: null
  },
  {
    id: "builtin-board-resolution-drafter",
    title: "Board Resolution Drafter",
    type: "assistant",
    practice: "Corporate",
    prompt: "## Board Resolution Drafter\n\nDraft a board resolution for the corporate action specified by the user. Follow standard corporate formalities and use bracketed placeholders where details are missing.\n\nInclude:\n- Title and company details\n- Recitals explaining background and authority\n- Formal resolution language approving the action\n- Authorization provisions for officers, directors, and advisers\n- Ratification of prior acts where appropriate\n- Signature blocks and date placeholders\n\nProvide both:\n1. **Short-Form Resolution** — concise approval language\n2. **Long-Form Resolution** — detailed recitals and authorizations\n\nAdd drafting notes identifying corporate approvals, filings, consents, or HIGH / MEDIUM / LOW governance risks to verify.",
    columnsConfig: null
  },
  {
    id: "builtin-due-diligence-checklist",
    title: "Due Diligence Checklist",
    type: "assistant",
    practice: "Corporate",
    prompt: "## Due Diligence Checklist\n\nGenerate a comprehensive due diligence checklist for the transaction described by the user. Tailor the checklist to the transaction type, industry, jurisdictions, and buyer or investor concerns.\n\nOrganize by category:\n- Corporate Records\n- Financial\n- Legal and Material Contracts\n- Intellectual Property\n- Employment and Benefits\n- Real Estate\n- Regulatory and Compliance\n- Environmental\n\nOutput as a table with columns: Category / Request Item / Purpose / Priority. Mark each item as Critical, Important, or Standard. Add a final **Key Risk Areas** section with HIGH / MEDIUM / LOW ratings for issues likely to affect valuation, closing, indemnities, or regulatory approvals.",
    columnsConfig: null
  }
];
