# Interim confirmatory results

## Status and scope

This is a descriptive checkpoint, not the final confirmatory result. The
frozen target remains 50 valid runs. Collection stopped under the predeclared
rule after sequence 14 produced three consecutive invalid attempts at the same
pre-stimulus BLE setup boundary. After a separate documented requalification
session restored repeatable warm-lifecycle readiness, collection resumed at
that same schedule position. No timeout, validity rule, retry allowance,
planned order, or target count was changed in response.

The current analysis contains 32 eligible confirmatory attempts across 20
completed schedule positions. Thirty-three confirmatory artifacts remain in
the immutable ledger; one passing tablet artifact is retained as supporting
evidence but excluded by the declared sequence-20 disposition:

- 20 valid runs, all passes;
- no valid failures;
- 12 invalid pre-stimulus attempts, which are apparatus/setup observations and
  not failed SUT evaluations; and
- 11 invalids localized to the BLE boundary and one to the application
  boundary.

Sequence 20 was repeated only after sequence 19 completed following diagnosis
and route requalification. The original sequence-20 pass remains immutable but
is excluded from confirmatory counts under anomaly `A-007`; its replacement is
the eligible result. Sequence 21 is next. Calibration, dry-run, and diagnostic
records remain outside these counts.

## Condition-level accounting

| Condition | Valid target | Attempts | Valid passes | Valid failures | Invalid attempts |
| --- | ---: | ---: | ---: | ---: | ---: |
| Injected healthy | 10 | 4 | 4 | 0 | 0 |
| Bumble healthy | 10 | 11 | 4 | 0 | 7 |
| Bumble dropped notification | 10 | 8 | 4 | 0 | 4 |
| Bumble malformed notification | 10 | 5 | 4 | 0 | 1 |
| Tablet healthy reference | 5 | 2 | 2 | 0 | 0 |
| Tablet malformed reference | 5 | 2 | 2 | 0 | 0 |

The uneven denominators are a consequence of the frozen schedule and stop
rule. They must not be treated as a balanced comparison or converted into
route failure-rate estimates.

## Descriptive timing

The timing summaries below use valid healthy confirmatory runs only. Values are
milliseconds from the normalized event record.

| Route | Metric | n | Minimum | Median | Mean | Maximum |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Injected | Motion observation | 4 | 978.011 | 995.267 | 997.123 | 1,019.947 |
| Injected | Completed-interval observation | 4 | 834.027 | 910.257 | 1,079.311 | 1,662.703 |
| Bumble BLE | Setup subscription | 4 | 2,262.937 | 3,148.146 | 4,048.371 | 7,634.255 |
| Bumble BLE | Motion observation | 4 | 790.571 | 871.764 | 882.276 | 995.005 |
| Bumble BLE | Completed-interval observation | 4 | 805.964 | 838.533 | 865.410 | 978.609 |
| Tablet BLE | Setup subscription | 2 | 3,926.368 | 5,183.977 | 5,183.977 | 6,441.586 |
| Tablet BLE | Motion observation | 2 | 1,030.192 | 1,031.996 | 1,031.996 | 1,033.800 |
| Tablet BLE | Completed-interval observation | 2 | 972.472 | 982.421 | 982.421 | 992.370 |

Every valid healthy confirmatory run observed both post-stimulus outcomes
within the frozen 2,000 ms bound. The four valid hybrid subscriptions also
occurred within the 8,000 ms setup bound, although the largest value was close
to that bound. These are small-sample descriptive observations, not
latency-distribution estimates.

## Diagnostic contrast after the stop

Three out-of-band isolation runs were retained as diagnostics and never folded
into the confirmatory ledger. The physical-tablet check
`calibration-isolation-tablet-005` was a valid pass: subscription took
2,444 ms, motion was observable after 991 ms, and the completed interval after
1,571 ms. Two isolated emulator/Bumble checks were invalid before stimulus.
One remained at `REQUESTING-PERMISSION` through the setup bound; the warm retry
reached `CONNECTING` but not `SUBSCRIBED` within the bound.

This contrast localized the recurring readiness condition to the hybrid path
under the observed configuration. It did not identify which component caused
it or show that the tablet route is generally more reliable.

A later bounded requalification session retained four additional calibration
records outside the confirmatory ledger. Two attempts connected but did not
finish GATT discovery and subscription within 8,000 ms; no stimulus was issued.
The next two unchanged warm lifecycles subscribed in 2,486 ms and 2,247 ms and
passed end to end without in-run intervention. The route was therefore
requalified under the existing invalid-attempt policy. Confirmatory retry
`c014-retry03-bumble-healthy-r03` then subscribed in 2,490 ms, displayed motion
after 851 ms, displayed the completed interval after 813 ms, disconnected
cleanly, and completed sequence 14 as a valid pass.

A second stop at sequence 19 triggered another separate requalification
series. After a clean emulator/Bumble restart, five calibration lifecycles
produced an application-invalid cold start, a pre-stimulus BLE invalid, a valid
post-stimulus failure, a valid pass, and another valid post-stimulus failure.
In both valid failures the fixture accepted and transmitted speed 8.0 and
reported notification success, but the app did not display motion within
2,000 ms. This series did not supply two consecutive unchanged passes, so it
does not support resumed confirmatory collection. These diagnostic outcomes
remain outside the confirmatory counts above.

A later targeted session retained one capture-compromised but valid diagnostic
failure followed by two fully captured, consecutive passes under unchanged
conditions. The first pass subscribed in 2,376 ms and observed motion and
completion in approximately 757 ms and 860 ms. The second subscribed in
2,178 ms and observed the same transitions in approximately 778 ms and 805 ms.
Those two passes requalified the route. Confirmatory retry
`c019-retry03-bumble-dropped-r04` then passed: the deliberately dropped first
notification produced no transition during 2,000 ms, sequence 2 recovered in
approximately 927 ms, and sequence 3 completed the interval in approximately
768 ms.

The earlier System UI ANR is consistent with the practical risk of running a
resource-heavy emulator on a memory-constrained host, but the retained data do
not establish that cause. Host CPU was moderate during the later clean pass
while available memory remained below 1 GB. Resource pressure is therefore an
operational hypothesis, not a diagnosed mechanism.

After a deliberate interval and fresh readiness check, replacement
`c020-retry01-tablet-malformed-r02` subscribed in 1,714 ms, rejected the
malformed first observation without entering motion, recovered on sequence 2,
completed one interval on sequence 3, and disconnected cleanly. The original
passing sequence-20 artifact is reported separately as supporting evidence and
does not affect the counts above.

## Interpretation against the paper's claim

The semantic-injection route exercised the application's state-transition
logic smoothly, but by construction it could not expose permission handling,
physical link establishment, GATT discovery, subscription readiness, or
controller/bridge timing. Those observations appeared only when the test route
crossed the physical BLE seam. In this worked example, virtualizing the test
client therefore did not eliminate physical dependencies; it relocated them
into the hybrid emulator/controller/fixture path.

That is the strongest warranted interpretation of the current evidence. It
supports a conditional assurance argument: a hardware-attached or hybrid route
is required when the assurance claim includes physical properties that a
substitute route neither exercises nor represents through prior validation.
It does not support a universal preference for physical testing.

The existing semantic-injection route is already the relevant substitute; a
second artificial "stub suite" is unnecessary. Its clean runs show what can be
learned above the boundary, while the BLE routes show the additional classes of
readiness and observability introduced by crossing it. Likewise, the controlled
dropped and malformed cases demonstrate route-specific fault observability;
they are not evidence that a commercial product defect was discovered or that
the additional apparatus is economically justified in every setting.

Calling the work merely "mobile automation" would therefore underspecify the
system under test. The mobile UI is the interaction and observation surface,
but the assurance target can extend through the communication path to the
physical producer of the observed state. Whether the troubleshooting cost is
worth paying depends on that declared assurance target, not on a blanket rule
about cloud, virtual, or self-hosted execution.

## Representative mechanism figure

The paired vector figure in
[`figures/representative-lifecycles.svg`](figures/representative-lifecycles.svg)
holds the Bumble-backed route and healthy case constant. It contrasts the
earliest ordinary successful hybrid lifecycle with the setup-invalid attempt
that activated the frozen stop rule. Its selection policy, caption,
accessibility text, and reproduction command are documented in
[`representative-timelines.md`](representative-timelines.md). The figure is an
explanatory descent into two named records, not an additional statistical
comparison.

## Reproduction and provenance

Run `npm run results:summarize` from `automation` to regenerate the private
CSV/JSON package beneath
`artifacts/evidence/pilot-v1/derived/interim-results`. The generator validates
record structure, reconciles retries against the frozen plan, enforces the
stimulus validity boundary, and keeps diagnostic runs separate. Sanitization
and release packaging remain a later step; the immutable raw evidence is not
committed to Git.
