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
| A-005 | Informational | Accepted | Confirmatory artifacts | Seven duplicate-content groups are explained by deterministic outputs. |
| A-006 | Informational | Resolved | Freeze identity | Current automation lock differs post-freeze; exact frozen lock is retained in the declared Git baseline. |

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

The checksum inventory found repeated deterministic serial transcripts for
identical scripted cases, empty serial logs for the injected route, and one UI
hierarchy shared by two attempts stopped in the same visible state. No
manifest, event stream, verdict, Bumble slice, Appium log, or `logcat` record is
duplicated across confirmatory identities.

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
