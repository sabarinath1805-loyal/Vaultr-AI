# Document Conversion and Malware Boundary

Date: 2026-08-10

## Current controls

- Uploads are type/magic validated and bounded before parser use.
- Malware scanning is a vendor-neutral boundary in `backend/src/lib/documentScanning.ts`.
- Production (or `DOCUMENT_SCANNER_REQUIRED=true`) fails closed when no scanner binary is configured.
- Scanner input is written to a 0700 temporary directory, invoked with `execFile` (no shell), bounded to 120 seconds, and removed in `finally`.
- Scanner exit code 1 is quarantine; unavailable/error states do not enter parsing or conversion.
- LibreOffice conversion uses a private 0700 temporary workspace, an allowlisted executable path, a 120-second timeout, input/output byte limits, PDF magic validation, and cleanup in `finally`.
- `backend/Dockerfile.document-converter` supplies a non-root LibreOffice image boundary.

## Deployment contract

The Dockerfile is a buildable boundary, not proof that the production deployment already routes requests through it. Production must wire a sidecar/worker or equivalent runner with:

- non-root UID, read-only root filesystem, writable scratch only under a dedicated temporary mount;
- no network egress unless the conversion image explicitly requires it;
- CPU, memory, process-count, wall-clock, and output-size limits;
- container-level seccomp/AppArmor or platform equivalent;
- separate scanner and converter identities where possible;
- queue/job ID, attempt count, terminal state, and operator-visible failure reason;
- cleanup of abandoned scratch directories and orphaned storage paths.

`DOCUMENT_CONVERSION_SANDBOX=container` is required as a production configuration signal. Until the deployment runner is wired and exercised, the API inline conversion path is a development/test capability and production readiness remains conditional.

## State machine

`pending_scan -> clean -> processing -> ready` is the clean path. Scanner rejection becomes terminal `quarantined`; scanner/configuration/crash failures become `failed`. A failed item may be deliberately retried through `pending_scan`. Quarantine requires explicit review before re-scan. See `backend/src/lib/documentRecovery.ts`.
