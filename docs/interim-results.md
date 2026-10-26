# Frozen confirmatory results and interpretation

## Status and scope

The `pilot-v1-frozen` confirmatory collection is complete. All 50 predeclared
schedule positions have an eligible valid observation. The immutable evidence
store contains 87 eligible confirmatory attempts plus one passing tablet run
that remains retained but is excluded under the outcome-independent ordering
disposition in anomaly `A-007`.

The eligible result contains:

- 50 valid runs: 49 passes and one failure;
- 37 invalid pre-stimulus attempts: 34 at the BLE boundary, two at the
  application-readiness boundary, and one at the executor boundary; and
- no incomplete or out-of-order schedule position.

Invalid attempts did not cross the declared `stimulus-issued` boundary. They
are apparatus-readiness observations, not failed evaluations of application
behavior. The one valid failure did cross that boundary and therefore counts
as an outcome under the frozen protocol. Calibration, dry-run, and diagnostic
records remain outside the confirmatory counts.

## Condition-level accounting

| Condition | Valid target | Attempts | Valid passes | Valid failures | Invalid attempts |
| --- | ---: | ---: | ---: | ---: | ---: |
| Injected healthy | 10 | 11 | 10 | 0 | 1 |
| Bumble healthy | 10 | 26 | 10 | 0 | 16 |
| Bumble dropped notification | 10 | 21 | 9 | 1 | 11 |
| Bumble malformed notification | 10 | 18 | 10 | 0 | 8 |
| Tablet healthy reference | 5 | 5 | 5 | 0 | 0 |
| Tablet malformed reference | 5 | 6 | 5 | 0 | 1 |

The attempt denominators reflect adaptive retries, route requalification, and
the frozen stopping rule. They are not balanced samples and must not be used to
estimate general route reliability or comparative failure rates.

## Descriptive healthy-case timing

The following summaries use valid healthy runs only. Values are milliseconds
from the normalized event records.

| Route | Metric | n | Minimum | Median | Mean | Maximum |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Injected | Motion observation | 10 | 833.879 | 986.668 | 1,003.458 | 1,351.169 |
| Injected | Completed-interval observation | 10 | 766.947 | 899.979 | 992.825 | 1,662.703 |
| Bumble BLE | Setup subscription | 10 | 2,026.416 | 2,559.811 | 3,095.181 | 7,634.255 |
| Bumble BLE | Motion observation | 10 | 730.782 | 820.625 | 863.107 | 1,048.720 |
| Bumble BLE | Completed-interval observation | 10 | 742.227 | 807.158 | 812.541 | 978.609 |
| Tablet BLE | Setup subscription | 5 | 1,552.582 | 2,238.288 | 3,255.988 | 6,441.586 |
| Tablet BLE | Motion observation | 5 | 951.009 | 1,005.078 | 995.593 | 1,033.800 |
| Tablet BLE | Completed-interval observation | 5 | 964.594 | 972.472 | 975.362 | 992.370 |

Every valid healthy run produced both post-stimulus observations within the
frozen 2,000 ms hard bound. Every valid BLE healthy run subscribed within the
8,000 ms setup bound. These values describe this apparatus and execution
history; they are not latency-distribution estimates or evidence that one
route is generally faster.

## The valid failure at sequence 46

Confirmatory run `c046-bumble-dropped-r10-retry01` is the only valid failure.
It subscribed in 4,384.9 ms, deliberately dropped sequence 1, and correctly
showed no transition during the 2,000 ms negative-observation window. Healthy
sequence 2 then produced callback `status=1, code=0` and became observable as
the expected In Motion state with the visible sequence gap after 1,980.3 ms.

The physical BLE link disconnected before the completion step. The fixture
accepted the sequence-3 speed-zero command, recorded a transmit attempt, and
then produced callback `status=5, code=0`. The application did not receive an
accepted stop observation and remained In Motion through the 2,000 ms bound.
The retained Bumble slice, fixture events, Appium-observed state and assertion,
screenshot, UI hierarchy, and verdict preserve the failure chain. The state
and assertion records share the Appium scenario and are not treated as
independent instruments. No in-run intervention occurred, and the run was not
retried because route-specific evidence corroborated command acceptance after
the frozen pre-invocation marker.

This observation is not presented as a discovered defect in a commercial
product, a BLE failure-rate estimate, or proof that physical execution is
superior. It demonstrates something narrower and more useful: a route that
crosses the physical delivery seam can expose a delivery-boundary outcome that
semantic injection bypasses by construction. A passing injected test can still
be correct for application-state logic while providing no evidence about that
physical delivery property.

## Interpretation against the paper's claim

The ten injected healthy passes establish that the semantic route repeatedly
exercised the selected application-state and UI behavior. The Bumble healthy
passes establish the same downstream behavior while additionally exercising
advertising, connection, GATT discovery, subscription, notification delivery,
payload decoding, and lifecycle coordination. The dropped and malformed cases
make two of those additional boundaries observable rather than merely listing
them architecturally. The tablet results corroborate selected behavior through
a native Android BLE controller without being pooled with the primary
emulator comparison.

The central result is therefore not `physical > virtual`. It is that route
adequacy is relative to the assurance claim:

- semantic injection was adequate for the executed application-state claim;
- it was structurally incapable of supporting a claim about BLE delivery or
  BLE payload acceptance;
- the Bumble route could support those additional claims when validly ready,
  while also exposing their additional failure boundaries; and
- the tablet reference reduced the plausibility that every observed BLE
  behavior was solely an artifact of the emulator/HCI-bridge configuration.

Virtualizing the test client did not eliminate the relevant physical
dependencies. It relocated them into a hybrid seam comprising emulator state,
Android Bluetooth behavior, Bumble, USB-controller ownership, radio delivery,
peripheral firmware, and their coordinated lifecycle. A hosted orchestrator
could schedule such a runner, but the verdict-bearing evidence would still
depend on access to that seam.

## Operational readiness without rate inflation

The 37 invalid pre-stimulus attempts are material because reporting only the
49 passes and one failure would conceal the work required to establish the
complete path. Conversely, treating those invalid attempts as SUT failures
would claim that application behavior was tested when no outcome-bearing
stimulus had been issued.

The concentration of invalid attempts at the BLE boundary shows that local
component checks were not sufficient to establish end-to-end readiness. A
responsive serial daemon, live emulator, responsive controller, enabled
Android adapter, and granted permission could coexist while the application
still failed to reach `SUBSCRIBED` within the declared bound. The in-run
subscription observation was therefore a necessary validity gate rather than
a redundant health check.

The records do not identify a single root cause for all invalid attempts.
Collection used adaptive retries, stopping rules, separate requalification
sessions, physical interventions between sessions, and a resource-constrained
host. Attempts are consequently neither independent nor identically situated.
The evidence supports a statement about observed apparatus burden and
composed readiness, not a numerical reliability comparison among injection,
Bumble, the emulator, the tablet, or physical hardware in general.

## Reviewer-facing evidence model

The evidence is organized as progressive disclosure rather than as a request
that a reviewer read every system log:

1. The manuscript states the claim-versus-route logic, aggregate counts,
   timing summaries, valid failure, limitations, and disposition rules.
2. Paper-facing tables and representative timelines let a reviewer inspect
   the principal contrasts without opening raw traces.
3. Generated condition and run summaries expose every eligible attempt,
   retry, validity classification, and exclusion.
4. A reviewer can descend from any summary row to its manifest, normalized
   events, verdict, screenshots, serial trace, Android log, and—where
   applicable—byte-verified Bumble slice.
5. Source, firmware, dependency locks, apparatus description, and frozen
   identities support independent reproduction after release.

Peer review should not depend on a reviewer owning the apparatus or recreating
the experiment. The paper must stand on a legible method and auditable retained
evidence. A reviewer may still inspect individual records, run the software-only
route, request clarification or artifacts, or attempt full replication; an
artifact-evaluation venue would be more likely than ordinary manuscript review
to execute substantial portions. The repository is designed to make such
inspection possible, not to make hardware replication a prerequisite for
understanding or accepting the argument.

## Scope and limitations

The study supports a structural, worked-example claim. It does not establish
that physical testing is universally preferable, characterize radio-frequency
performance, reproduce an industrial ECU or regulated device, measure economic
benefit, or demonstrate regulatory compliance. The fixed repetition counts
show reproducibility within this apparatus; they were not selected through a
power analysis and do not justify population inference.

The single valid failure is valuable because it was retained under a rule
declared before its outcome was known. It should nevertheless remain a
mechanism-demonstrating observation, not be inflated into a prevalence claim.
Likewise, the high setup attrition is evidence that the hybrid route had an
operational cost on this host, not proof that every hardware-attached route is
fragile or that the cost is justified for every assurance target.

## Reproduction and provenance

Run `npm run results:summarize` from `automation` to regenerate the private
CSV/JSON result package beneath
`artifacts/evidence/pilot-v1/derived/interim-results`. Run
`npm run audit:evidence:strict` to validate schemas, retry lineage, dispositions,
event ordering, required captures, and Bumble-slice byte ranges. At completion,
the strict audit reported zero errors and two disclosed warnings across 2,587
events, with 65 Bumble slices byte-verified.

The remaining warnings correspond to anomalies `A-002` and `A-004` and do not
alter a confirmatory verdict. Sanitization and public release packaging remain
separate work; the immutable raw evidence is intentionally excluded from the
development Git history.
