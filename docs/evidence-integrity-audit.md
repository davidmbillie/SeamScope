# Pilot evidence-integrity audit

## Outcome

The updated 2026-10-25 audit completed with **zero integrity errors, two warnings,
and one expected post-freeze observation**. The confirmatory result accounting
in `docs/interim-results.md` remains supported by the retained evidence.

The audit is reproducible with:

```powershell
cd automation
npm run audit:evidence
```

The machine report and checksum inventory are generated privately under
`artifacts/evidence/pilot-v1/derived/integrity-audit`. They are not committed
because the current `artifacts` tree is the untouched private evidence layer.

## Audited scope

| Check | Result |
| --- | ---: |
| Run directories examined | 120 |
| Retained confirmatory attempt records | 33 |
| Confirmatory records excluded by declared disposition | 1 |
| Normalized events validated | 1,522 |
| Run records valid against the version-1 schemas | 120 |
| Confirmatory Bumble slices compared with source-session bytes | 24 |
| Files entered in the current SHA-256 inventory | 318 |
| Duplicate-content groups among confirmatory artifacts | 8 |

All run manifests, event streams, and verdicts parsed successfully. The audit
checked schema conformance, run and event identities, contiguous event indices,
host-time ordering, validity-boundary crossing, manual-intervention flags,
final-event/verdict agreement, frozen-plan correspondence, retry chains,
route-specific log presence and non-emptiness, normalized fixture lines against
the retained serial trace, PNG signatures, Android UI-hierarchy structure,
checkpoint captures, assertion/verdict consistency, and the presence and
schedule identity of every excluded run and its declared replacement.

## Freeze identity

The private freeze metadata, committed sanitized freeze record, and study
manifest agree on the study identifier, protocol version, source-snapshot hash,
run-plan hash, frozen APK hash, and firmware-application hash.

The following retained artifacts match both their declared byte lengths and
SHA-256 identities:

- firmware source;
- frozen run plan;
- frozen application APK;
- mobile dependency lock;
- firmware application binary;
- firmware bootloader binary; and
- firmware partition-table binary.

The current automation dependency lock differs because the audit tooling added
direct schema-validation dependencies after collection. The audit independently
confirmed that baseline commit `257702d1ad8c3a246540279145b4cd6a282b0aff`
still contains the exact frozen lock bytes and hash. This is expected
post-freeze worktree evolution, not loss of the frozen identity.

The exact frozen APK was recovered from the frozen emulator installation and
retained privately at `artifacts/freeze/application/seamscope-frozen.apk`.
Its 38,615,629-byte size and SHA-256 identity match the freeze record. A later
debug build remains distinct and was not substituted.

## Confirmatory record relationships

All 33 retained confirmatory attempts map to frozen schedule entries. Their route, case,
and repetition fields agree with the plan; retry manifests and verdicts agree;
and every retry points to the immediately preceding attempt. The disposition
registry excludes the original passing sequence-20 record while retaining it
as supporting evidence and identifies the eligible post-requalification
replacement at the same frozen schedule position. Sequences 1 through 20 are
complete; sequence 21 is next.

Every valid run crosses the declared `stimulus-issued` boundary, and every
invalid run remains before it. Final normalized events agree with the stored
verdicts. All valid passing runs contain passing normalized assertions and both
declared checkpoint screenshots. The first invalid sequence-6 attempt is the
only confirmatory record missing its usual failure screenshot and UI hierarchy;
its Appium, `logcat`, serial, Bumble, event, and verdict evidence remains
available.

All 24 Bumble-backed confirmatory attempts contain capture metadata and a
retained Bumble slice. Each slice has the declared length and is byte-identical
to the corresponding offset range in its named source session log.

## Schema compatibility discovered by the audit

Two declaration defects were corrected without modifying raw evidence:

1. The frozen study manifest already contained `frozenAt`, but the version-1
   schema omitted that allowed property.
2. The fixture parser lowercased the line token `MALFORM` to the historical
   event literal `malform`, while the TypeScript vocabulary and schema declared
   `malformed`. Nine retained events use the unambiguous historical literal,
   including four confirmatory events. The schema now recognizes it as a
   legacy version-1 alias while retaining `malformed` as the canonical term.

Changing the emitter before any resumed collection would alter the normalized
observation representation. That change is therefore deferred to the
collection/protocol-version decision rather than silently folded into the
frozen pilot.

## Duplicate-content review

Eight duplicate hash groups were found. They are deterministic serial
transcripts, empty injected-route serial logs, or repeated captures of the same
visible setup state. No manifests, event streams, verdicts, Bumble slices,
Appium logs, or `logcat` records are duplicated across confirmatory run
identities. The duplicate groups therefore do not indicate copied or aliased
run records.

## Interpretation

The audit does not convert invalid setup attempts into application failures or
claim that the still-in-progress 50-run matrix is complete. It establishes that
the interim counts, timings, route distinctions, stop-rule account, documented
requalification, valid completion through sequence 20, and the explicit
sequence-20 exclusion/replacement disposition are traceable to internally
consistent retained records. Remaining warnings concern one confirmatory
failure-capture omission and one supporting-run timestamp reversal; both are
disclosed in `docs/anomaly-ledger.md`.
