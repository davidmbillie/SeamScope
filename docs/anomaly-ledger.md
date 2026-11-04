# Pilot anomaly ledger

This ledger records irregularities without rewriting the frozen protocol or
the immutable raw evidence. Severity describes the effect on reproducibility
or interpretation, not the apparent inconvenience of the underlying event.

| ID | Severity | Status | Scope | Summary |
| --- | --- | --- | --- | --- |
| A-001 | Moderate | Resolved | Freeze artifact | Exact frozen APK was recovered from the frozen emulator installation and retained separately from later builds. |
| A-002 | Low | Accepted | Confirmatory sequence 6 | First invalid attempt lacks the usual failure screenshot and UI hierarchy. |
| A-003 | Low | Compatibility documented | Evidence schema | Nine events use historical literal `malform` rather than canonical `malformed`. |
| A-004 | Low | Accepted | Supporting calibration | One retrospectively appended intervention event has an earlier action timestamp than its preceding event. |
| A-005 | Informational | Accepted | Confirmatory artifacts | Nine duplicate-content groups are explained by deterministic outputs, empty placeholders, and repeated setup-state captures. |
| A-006 | Informational | Resolved | Freeze identity | Current automation lock differs post-freeze; exact frozen lock is retained in the declared Git baseline. |
| A-007 | Moderate | Resolved | Confirmatory ordering | Sequence 20 was executed after sequence 19 activated the stop rule; the original pass is excluded and a post-requalification replacement is eligible. |
| A-008 | Low | Accepted | Supporting calibration | Calibration 010 crossed stimulus with a path-resolution error that prevented its normal per-run capture. |
| A-009 | Low | Resolved | Confirmatory sequence 21 | The first manifest used the wrong configuration identifier and was stopped before executor startup or stimulus. |
| A-010 | Moderate | Resolved | Confirmatory continuation | Sequences 34, 36, and 39 activated the frozen stop rule and resumed only after separate route requalification. |
| A-011 | Informational | Accepted result | Confirmatory sequence 46 | A valid dropped-notification run failed after the BLE link disconnected before the completion observation. |

## A-001: exact frozen APK recovered

The freeze records identify the executed APK as 38,615,629 bytes with SHA-256
`b4e95c55c29e19a54f084e92afac6df498fe440a9e903f1137ea9825d1c74ff8`.
The APK at the ordinary debug-build output is a later build and was not used as
a substitute. The exact executed package was recovered from the retained
emulator installation and stored privately at
`artifacts/freeze/application/seamscope-frozen.apk`. Its size and SHA-256 match
the freeze record exactly. The integrity audit now verifies that retained copy
directly.

Impact: binary preservation and direct byte verification are restored. The APK
remains ignored with the private artifact layer until the release package and
redistribution boundary are decided. No run verdict changed.

## A-002: missing failure UI capture on `c006-bumble-healthy-r02`

The initial invalid attempt for sequence 6 has no `failure.png` or
`failure-ui.xml`. Its normalized events, verdict, Appium output, Android
`logcat`, serial trace, capture metadata, and byte-verified Bumble slice are
present. Those sources retain the permission completion, BLE connection,
disconnect, and `GATT_CONN_TIMEOUT` evidence used to localize the attempt.

Impact: visual auditability is weaker for this one invalid setup attempt, but
its pre-stimulus validity classification and BLE-boundary localization do not
depend solely on a missing screenshot. The record remains included and the
omission remains disclosed.

## A-003: historical `malform` event literal

The frozen parser lowercased the fixture token `MALFORM` and emitted `malform`.
The declared TypeScript union and original JSON Schema instead named the event
`malformed`. Nine records contain this literal, four of them confirmatory. Each
retains the source line, sequence number, malformed-notification case identity,
application diagnostic, assertions, and verdict, so its meaning is not
ambiguous.

Impact: this was a schema/vocabulary mismatch, not missing behavioral evidence.
The version-1 event schema now accepts `malform` as a documented legacy alias;
the raw records were not edited. Canonicalizing the emitter is deferred because
changing observation serialization before resumed collection must be handled
under the protocol-version decision.

## A-004: retrospective timestamp in supporting calibration

In `calibration-healthy-bumble-020`, event 17 records a manual Android
Bluetooth cycle after the behavioral events but uses the earlier time at which
the intervention occurred. Its `hostObservedAt` value is therefore earlier
than event 16 even though its append-only `eventIndex` is later.

Impact: the event index describes record append order while the timestamp
describes intervention time. This calibration run is outside the confirmatory
result and the three named post-stop isolation diagnostics. No confirmatory
event stream contains a host-time reversal.

## A-005: explainable duplicate-content groups

The checksum inventory found nine groups: repeated deterministic serial
transcripts for identical scripted cases; one zero-byte group containing empty
injected-route serial logs and the first sequence-21 attempt's pre-executor
placeholders; and two UI-hierarchy hash groups containing repeated captures of
the same visible setup state. No manifest, event stream, verdict, Bumble slice,
Appium log, or `logcat` record is duplicated across confirmatory identities.

Impact: the duplicates reflect repeated deterministic output rather than
duplicated experimental records.

## A-006: post-freeze dependency-lock evolution

The current automation lock changed when AJV and its format package were made
direct development dependencies of the audit tool. The audit retrieved the
lock from baseline commit `257702d1ad8c3a246540279145b4cd6a282b0aff` and
confirmed the frozen SHA-256
`8c772bb8e4457c56eb3ccf34fba7dad6e3a4953225dfc2cec6ebb69e4615c501`.

Impact: the current research tooling has evolved, while the exact execution-
time dependency declaration remains recoverable from the frozen Git identity.
The change does not claim to be part of the executed apparatus.

## A-007: sequence 20 collected across a stop-rule boundary

Sequence 19 (`c019-bumble-dropped-r04`) and its two permitted retries were
invalid before stimulus at the BLE setup boundary. The third attempt activated
the frozen stop rule. The following tablet reference,
`c020-tablet-malformed-r02`, was nevertheless started before the required
Bumble diagnosis and requalification were complete. It was technically valid,
passed its declared assertions, and disconnected cleanly, but its execution
order departed from the frozen rule that diagnosis precede another planned
run.

Disposition: the raw record and verdict remain immutable. The passing original
is retained as supporting evidence but excluded from confirmatory counts by
`automation/evidence/dispositions/pilot-v1.json`. After two consecutive Bumble
requalification passes and valid completion of sequence 19, sequence 20 was
repeated as `c020-retry01-tablet-malformed-r02`; the replacement also passed
and is the eligible confirmatory result. This outcome-independent exclusion of
a passing record preserves the frozen ordering rule without silently relabeling
or deleting favorable evidence.

## A-008: calibration 010 capture-path error

The first targeted follow-up lifecycle after the second stop used relative
evidence paths while the runner's working directory was `automation/`. The
scenario crossed the stimulus boundary and failed its completed-interval
observation, but the usual Appium, logcat, serial, and Bumble captures were not
written into its pre-created run directory. The managed-runner console showed
the outcome, and the fixture's subsequent status showed that both commands had
been issued.

Impact: `calibration-requalification-bumble-010` is retained as a valid but
capture-compromised diagnostic and is excluded from the qualifying pair. Its
stimulus markers and final boundary event were appended as explicit
reconstructions rather than presented as original normalized capture. All
subsequent paths were absolute; calibrations `011` and `012` were fully
captured and supplied the two consecutive passes used for requalification.

## A-009: sequence-21 manifest initialization error

The first sequence-21 directory, `c021-injected-healthy-r05`, was initialized
with configuration identifier `injected-frozen` instead of the declared
`emulator-injected-frozen`. The discrepancy was detected before Appium started
and before any stimulus was issued. The immutable directory therefore contains
its manifest, two lifecycle events, an `invalid / not-evaluated` executor-
boundary verdict, and empty log placeholders rather than application captures.

Disposition: the original record remains visible. The correctly initialized
`c021-retry01-injected-healthy-r05` names it through `retryOf`, executed the
scheduled case, and passed. The integrity audit treats empty Appium/logcat
placeholders and absent UI failure captures as expected only for an invalid
executor-boundary record that contains neither an Appium event nor a stimulus.
This narrow exception does not relax capture checks for application-, BLE-, or
post-stimulus records.

## A-010: later stop-rule and requalification cycles

Sequences 34, 36, and 39 each accumulated three consecutive pre-stimulus
invalid attempts and activated the frozen stop rule. Collection did not advance
past any stopped position until the hybrid route was diagnosed separately and
two unchanged, fully captured calibration passes established repeatable
readiness.

- Sequence 34 resumed as `c034-bumble-healthy-r07-retry03` only after
  calibrations `028` and `029` supplied the qualifying pair. The resumed run
  passed.
- Sequence 36 initially stopped after the base attempt and retries `01` and
  `02`. Calibrations `037` and `038` later supplied a fully captured qualifying
  pair. The first post-requalification confirmatory attempt, retry `03`, was
  itself invalid before stimulus and was retained as the first occurrence in
  the new session; retry `04` then validly passed.
- Sequence 39 stopped after its base attempt and retries `01` and `02`.
  Calibrations `044` and `045` supplied the later qualifying pair, after which
  retry `03` validly passed.

Several diagnostic sessions included application resets, Android Bluetooth
cycles, clean emulator/Bumble restarts, targeted USB-device recovery, a host
restart, and physical fixture recovery. These actions occurred between runs,
not inside verdict-bearing executions. Calibration records preserve the
sequence and outcome of those actions; no confirmatory verdict was converted
from invalid to valid retrospectively.

Impact: the repeated stops show substantial operational burden in this
particular hybrid apparatus. They do not supply independent observations for a
route failure-rate estimate, identify a universal component root cause, or
justify discarding later valid results. Following the frozen stop and
requalification rules preserves the planned valid-run target without selecting
an undisclosed favorable window.

## A-011: valid BLE-boundary failure at sequence 46

`c046-bumble-dropped-r10-retry01` reached `SUBSCRIBED`, crossed the declared
stimulus boundary, correctly observed the deliberate sequence-1 drop, and
recovered to In Motion after delivery of sequence 2. The corresponding raw
callback line was `BLE NOTIFY STATUS 1 CODE 0`. The BLE link then disconnected.
The fixture accepted the sequence-3 speed-zero command and recorded a transmit
attempt, after which the raw callback line was `BLE NOTIFY STATUS 5 CODE 0`.
The application remained In Motion and the completed-interval assertion timed
out at 2,000 ms. The two numeric fields are retained literally here; no library
success/failure meaning is inferred from either integer alone.

Disposition: retain the run as `valid / fail` at the BLE boundary and count it
toward the predeclared dropped-notification target. It was not retried because
the outcome-bearing stimulus had been issued and no evidence invalidated the
execution. The following scheduled injected run remained a separate plan
position rather than a replacement.

Impact: this is a confirmatory result, not an excluded apparatus attempt and
not a claimed commercial-product defect. It supplies a concrete example of a
failure observable only on a route that includes the physical delivery seam.
It supports the claim that route substitution changes evidential scope; one
observation does not estimate prevalence or establish that physical execution
is generally superior.
