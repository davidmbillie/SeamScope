# Pilot evidence-integrity audit

## Outcome

The completed 2026-10-25 audit reports **zero integrity errors, two warnings,
and one expected post-freeze observation**. The final confirmatory result
accounting in `docs/interim-results.md` is supported by the retained evidence.

The audit is reproducible with:

```powershell
cd automation
npm run audit:evidence:strict
```

The machine report and checksum inventory are generated privately under
`artifacts/evidence/pilot-v1/derived/integrity-audit`. They are not committed
because the current `artifacts` tree is the untouched private evidence layer.

## Audited scope

| Check | Result |
| --- | ---: |
| Run directories examined | 209 |
| Retained confirmatory attempt records | 88 |
| Confirmatory records excluded by declared disposition | 1 |
| Normalized events validated | 2,587 |
| Run records valid against the version-1 schemas | 209 |
| Confirmatory Bumble slices compared with source-session bytes | 65 |
| Valid retained runs with route-specific postconditions verified | 51 |
| Stimulus postconditions verified across those valid runs | 128 |
| Files entered in the current SHA-256 inventory | 839 |
| Duplicate-content groups among confirmatory artifacts | 9 |

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

All 88 retained confirmatory records map to frozen schedule entries. Of these,
87 are eligible attempts and one is the excluded-but-retained original
sequence-20 pass. Their route, case, and repetition fields agree with the plan;
retry manifests and verdicts agree; and every retry points to the immediately
preceding attempt. The disposition registry identifies the eligible
post-requalification replacement at sequence 20. All 50 schedule positions are
complete with 50 valid outcomes: 49 passes and one failure.

Every valid run contains a `stimulus-issued` marker, and every invalid run
remains before it. Because the frozen implementations emitted that marker
immediately before invoking the route operation, the audit now also checks the
route-specific postcondition after every marker. All 51 retained valid records
(50 eligible plus the retained, excluded sequence-20 pass) satisfied those
checks across 128 stimuli: BLE routes retained a matching `OK SPEED`
acknowledgement, while injection retained a downstream Appium-observed state or
assertion before the next stimulus. The marker is therefore treated as a
pre-invocation record whose stated acceptance boundary is corroborated by its
postcondition, not as acceptance evidence by itself.

Final normalized events agree with the stored verdicts. All valid passing runs
contain passing normalized assertions and both declared checkpoint screenshots.
The first invalid sequence-6 attempt is the only confirmatory record missing
its usual failure screenshot and UI hierarchy; its Appium, `logcat`, serial,
Bumble, event, and verdict evidence remains available.

All 65 audited Bumble-backed confirmatory captures contain metadata and a
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

Nine duplicate hash groups were found. They are deterministic serial
transcripts, empty injected-route serial logs, or repeated captures of the same
visible setup state. No manifests, event streams, verdicts, Bumble slices,
Appium logs, or `logcat` records are duplicated across confirmatory run
identities. The duplicate groups therefore do not indicate copied or aliased
run records.

## Interpretation

The audit does not convert invalid setup attempts into application failures or
interpret the one valid failure beyond its retained boundary evidence. It
establishes that the final counts, timings, route distinctions, stop-rule
accounts, requalifications, sequence-20 disposition, route-specific stimulus
postconditions, and completion of all 50 planned positions are traceable to
internally consistent records. It remains an artifact-integrity and
internal-consistency audit rather than independent methodological validation.
Remaining warnings concern one invalid confirmatory attempt's missing failure
capture and one supporting-run timestamp reversal; both are disclosed in
`docs/anomaly-ledger.md`.
