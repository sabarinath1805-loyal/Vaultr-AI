# Workflow Provenance

Date: 2026-08-10

- Source: `https://github.com/Open-Legal-Products/mike-workflows.git`
- Approved revision: `4b9c7cd0d93b6254780abcc2cc382be6b56cd945`
- Collections: `assistant-workflows`, `tabular-review-workflows`
- Generated system workflows: 31
- License evidence: upstream `LICENSE` is MIT; upstream provenance metadata was present in the checked source.
- Generator: `scripts/build-workflows.js`
- Freshness gate: `scripts/check-workflow-freshness.mjs`
- CI behavior: checkout the exact SHA into `mike-workflows`, then regenerate into a temporary directory and byte-compare the committed artifact.

The source is not vendored into this repository. Missing source, a non-40-character ref, a SHA mismatch, parser failure, or generated-artifact drift fails the gate.
