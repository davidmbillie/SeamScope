# Draft verdict-local claim assessments

This folder implements the paper's compact record as an illustrative companion
artifact. It is a small per-execution, per-claim projection that may be mapped
to a richer assurance model such as SACM; it is not a competing metamodel,
interchange standard, or validated CI feature.

The four populated records hold two atomic claims constant across two passing
executions:

- `c001-injected-healthy-r01`; and
- `c002-bumble-healthy-r01`.

Both records support the bounded application-state claim. Only the Serial/BLE
record supports the configured BLE-delivery claim; the injected record is
`notSupportedByRoute` for that claim even though its ordinary test outcome is
`pass`.

The `artifact://` references are sanitized, release-package-relative identities
for the frozen evidence tree under `artifacts/evidence/pilot-v1`. Raw run
records remain git-ignored until the evidence release is sanitized and
packaged. Repository source and documentation references use `repo://`.

## Contents

- `claim-catalog.json` versions the two claims and their identified material
  properties.
- `records/` contains one annotation per `(verdict, atomic claim)` pair.
- `invalid-fixtures/` contains a deliberately contradictory record that the
  semantic validator must reject.
- `../schemas/claim-assessment.schema.json` validates structural shape and
  validity/outcome consistency.
- `../../scripts/validate-claim-assessments.mjs` checks catalog alignment and
  cross-property disposition rules that JSON Schema cannot conveniently
  express.

Run from `automation/`:

```powershell
npm run verdict-records:check
```

Passing validation demonstrates that the proposed annotation is machine
representable and internally consistent. It does not demonstrate completeness,
interoperability, analyst agreement, improved decisions, or general utility.
