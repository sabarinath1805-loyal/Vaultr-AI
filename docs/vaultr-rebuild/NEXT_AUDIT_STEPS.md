# Next Audit Steps

The following are the next ten audit tasks. They are intentionally ordered to reduce uncertainty before any product implementation, branch merge, refactor, or Vaultr port is authorized.

1. **Build the endpoint authorization matrix.** Enumerate every backend route, HTTP method, identity requirement, owner/member rule, MFA requirement, storage side effect, and error behavior. Add negative-test cases for two users and shared/non-shared projects.

2. **Trace the service-role/RLS boundary.** For each table and mutation, record whether protection comes from RLS, a route filter, `access.ts`, a database function, or an unverified assumption. Identify queries that accept caller-supplied IDs.

3. **Triage the dependency advisories.** Generate a lockfile/package reachability report for the 46 backend and 69 frontend production advisories. Separate runtime-reachable parser/network vulnerabilities from test/build-only chains, then select upgrades, compensating controls, or accepted risks with owners.

4. **Complete the cross-platform test path.** Decide whether supported local execution is Windows-native, WSL, Linux, or Docker. Remove the Bash/inline-env ambiguity or document the supported runner, then make root stack tests and Word add-in E2E executable in that environment.

5. **Repair the frontend unit baseline.** Reproduce the three Blob `.text()` failures under the supported Node/jsdom matrix. Establish whether the API contract, test mock, or runtime polyfill is wrong and make the test suite green without weakening export coverage.

6. **Threat-model document ingestion and conversion.** Test malformed PDF/DOCX/XLSX/PPTX, macros/external references, decompression/CPU/memory limits, 100 MB boundary behavior, LibreOffice privileges, cancellation, and storage cleanup after partial failure.

7. **Threat-model LLM and MCP tool use.** Test prompt injection from documents/workflows/MCP results, cross-context citation leakage, tool-confirmation bypass, edit scope, model-provider data handling, OAuth redirects, DNS rebinding, and outbound timeout/body limits.

8. **Resolve schema and generated-input drift.** Compare `backend/schema.sql` with every migration; add a check for migration-only tables. Make the sibling `mike-workflows` input or generated artifact reproducible in CI and record its provenance.

9. **Inventory privacy and observability.** Enumerate logs, raw LLM stream options, traces, error reports, container logs, storage prefixes, retention, and deletion behavior. Prove that document text, prompts, API keys, OAuth tokens, and signed URLs are not retained unexpectedly.

10. **Create the Vaultr provenance/parity matrix.** After the current Mike baseline is accepted, compare `old-vaultr-backup` to current features by user flow and data model. For each candidate port, record exact source commits, license/provenance, behavior differences, migration cost, test evidence, and an explicit keep/replace/defer decision.

## Exit criteria for the next audit gate

The next gate should not be marked complete until:

- the authorization matrix has negative tests;
- dependency findings have owners and dispositions;
- a supported environment runs root/backend/Word E2E;
- frontend unit tests are green;
- schema, generated workflows, and deployment prerequisites are reproducible;
- security/privacy findings have evidence or explicit accepted-risk records;
- no Vaultr code has been ported without provenance and license review.
