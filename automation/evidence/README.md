# Evidence capture scaffold

The evidence store creates append-oriented run records under the git-ignored
`artifacts/evidence` directory. The raw directory layout follows
`docs/pilot-protocol-decisions.md`; frozen study exports retain the same layout
when deposited with the research artifact.

The CLI deliberately does not launch the emulator, Appium, Bumble, or the
fixture. It establishes the record boundary into which those processes will be
wired after dry-run calibration.

## Progressive disclosure

The evidence is organized so that a reader does not need to inspect granular
system logs to understand a reported result:

1. the manuscript reports condition-level findings;
2. derived summaries report the values behind those findings;
3. each run's `manifest.json`, `events.jsonl`, and `verdict.json` expose the
   normalized evidence and decision;
4. screenshots and route-specific raw logs support deeper audit; and
5. the untouched private capture remains the forensic source from which a
   sanitized release package can be generated.

The committed freeze record is
[`freezes/pilot-v1.json`](freezes/pilot-v1.json). It contains the portable
identity of the frozen study, hashes of the execution artifacts, relevant tool
and platform versions, and the first corresponding Git baseline. It is not the
canonical machine capture and does not claim that the study was executed from
a commit created after collection began.

The canonical private record remains at
`artifacts/evidence/pilot-v1/freeze-metadata.json`, beneath the repository's
ignored `artifacts/` tree. It is preserved unchanged. The committed record
excludes unique device and controller serials, ephemeral Android and serial
port addresses, and absolute local paths. Repository-controlled paths are
relative. Full logs and executable binaries are also excluded from Git; their
hashes bind them to the freeze record.

## Commands

Run commands from `automation`.

Create a draft calibration study:

```powershell
node .\scripts\evidence-cli.mjs init-study `
  --study-id pilot-v1 `
  --protocol-version pilot-v1-draft `
  --repetitions 10
```

Create a run record:

```powershell
node .\scripts\evidence-cli.mjs start-run `
  --study ..\artifacts\evidence\pilot-v1 `
  --case healthy-threshold `
  --route injected `
  --repetition 1 `
  --configuration pixel-api35-debug
```

The command prints the new run directory. Record a normalized event:

```powershell
node .\scripts\evidence-cli.mjs event `
  --run <run-directory> `
  --source runner `
  --type stimulus-issued `
  --sequence 1 `
  --details '{"speed":8}'
```

Finalize a valid run:

```powershell
node .\scripts\evidence-cli.mjs verdict `
  --run <run-directory> `
  --validity valid `
  --outcome pass `
  --expected 'In Motion view displays 8.0' `
  --observed 'In Motion view displayed 8.0' `
  --claim 'Accepted observations cause the configured transition'
```

Validate completeness and run-local event ordering:

```powershell
node .\scripts\evidence-cli.mjs validate-run --run <run-directory>
```

Generate the private, deterministic interim result package from the frozen
plan and immutable run records:

```powershell
npm run results:summarize
```

The command writes CSV, JSON, and a compact reader guide beneath
`artifacts/evidence/pilot-v1/derived/interim-results`. Confirmatory attempts,
calibration/diagnostic runs, setup validity, and post-stimulus outcomes remain
separate. The output is ignored by Git until the later sanitization and release
packaging step.

Run the evidence-integrity audit and generate the private checksum inventory:

```powershell
npm run audit:evidence
```

Use `npm run audit:evidence:strict` when an unresolved integrity error should
produce a non-zero exit status. Warnings and documented observations remain in
the report without making the ordinary reporting command fail. The generated
report and SHA-256 inventory are written beneath
`artifacts/evidence/pilot-v1/derived/integrity-audit` and remain ignored until
the sanitized package is assembled.

Build and verify the progressively disclosed release companion with:

```powershell
npm run release:evidence:build
npm run release:evidence:verify
```

The ignored output is written to
`artifacts/release/seamscope-pilot-v1-evidence`. The builder preserves all
normalized confirmatory records byte-for-byte, sanitizes only selected
representative text traces, checks every claim-assessment artifact reference,
validates the frozen binaries, scans for prohibited identifiers, and writes a
complete checksum inventory. See `release/SANITIZATION.md` for the inclusion
boundary.

Generate and verify the paper-facing evidence chain for the sole valid
confirmatory failure:

```powershell
npm run failure-chain:generate
npm run failure-chain:check
```

The command validates the named immutable run before producing a sanitized
JSON/CSV source and SVG. It fails if the run identity, case, route, verdict, or
selected events no longer match the declared figure.

Validate the illustrative verdict-local claim assessments:

```powershell
npm run verdict-records:check
```

This checks the draft JSON structures, their alignment with the versioned
claim/property catalog, the distinction among execution validity, ordinary
test outcome, and claim disposition, and the rule that a bypassed or
unvalidated material property cannot coexist with a supporting disposition.
The companion is documented in
[`claim-assessments/README.md`](claim-assessments/README.md).

## Invariants already enforced

- Run identifiers and run directories cannot be silently overwritten.
- A BLE-only fault case cannot be assigned to the injected route.
- Every normalized event carries the run identifier and a contiguous local
  event index.
- An invalid run must have outcome `not-evaluated`; it cannot be counted as a
  failing SUT result.
- A verdict cannot overwrite an earlier verdict.
- Bumble logs are required only for the Bumble-backed route.

The managed runner integrates serial, Appium, logcat, and applicable Bumble
output with normalized events, screenshots, manifests, and verdicts. These
layers remain separate so setup validity, application behavior, and
infrastructure diagnostics are not collapsed into one undifferentiated log.

## Schemas

The JSON Schema files in `schemas/` define the version-1 evidence contracts,
including the sanitized freeze record, plus the explicitly draft `0.1-draft`
claim-assessment companion. The companion uses AJV for structural validation
and a small semantic validator for catalog and cross-property rules.
