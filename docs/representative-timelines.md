# Representative lifecycle contrast

## Selection purpose

The two timelines illustrate what becomes observable when a test crosses the
physical BLE seam. They do not estimate the frequency or comparative
reliability of an execution route.

Both records use the Bumble-backed hybrid route and the healthy-threshold case.
Holding those properties constant avoids constructing the contrast from a
smooth semantic-injection run and an inconvenient hardware run. The difference
shown is lifecycle reach: one attempt established readiness and crossed the
stimulus boundary; the other established a physical link but never became
ready for a valid behavioral evaluation.

## Selection rules

The selection was made from frozen evidence before preparing the figure:

1. Use confirmatory records, not calibration, dry-run, or post-stop diagnostic
   records.
2. Hold the route and behavioral case constant.
3. Require complete supporting route evidence.
4. Choose the earliest ordinary successful hybrid run rather than the fastest
   or most visually convenient pass.
5. Choose the invalid attempt with direct protocol significance: the attempt
   that activated the predeclared stop rule.
6. Present the pair as a mechanism illustration and never as a frequency
   estimate.

These rules select:

- Panel A: `c002-bumble-healthy-r01`, the first scheduled successful healthy
  hybrid run; and
- Panel B: `c014-retry02-bumble-healthy-r03`, the third consecutive setup
  invalid for sequence 14 and the attempt that stopped collection for
  diagnosis.

Neither run records a manual intervention during its evidence boundary. Both
Bumble slices were byte-verified against their source session logs during the
integrity audit.

## Presentation decisions

`OK RESET` is time zero within each panel. Displayed times are rounded to three
decimal places; the retained normalized events preserve their original numeric
values. Events identify their observation source so that fixture, runner,
Appium, and application statements are not collapsed into a single narrator.

The stimulus boundary is visually explicit. Panel A crosses it when the motion
command is issued and therefore receives a behavioral verdict. Panel B remains
`CONNECTING` through the frozen readiness bound, issues no stimulus, and is
classified `invalid / not evaluated`. Its setup evidence remains analytically
important without being mislabeled as an application failure.

The figure omits process startup, screenshot capture, and teardown overhead
that do not explain the mechanism. It also omits machine paths, device and
controller identifiers, local port names, and incidental Bluetooth traffic.
The full normalized events and raw route logs remain available through the
progressive-disclosure evidence package.

## Paper-facing caption

**Figure X. Two lifecycles through the same hybrid execution route.** In the
successful confirmatory attempt (A), the physical BLE link was followed by GATT
subscription readiness, the declared stimulus boundary, observable motion, and
a completed interval. In the setup-invalid attempt (B), the physical link was
established but the application remained `CONNECTING` through the frozen
readiness bound; no stimulus was issued and no behavioral verdict was assigned.
The pair illustrates that link establishment, subscription readiness, and
application behavior are distinct evidence boundaries. It is a mechanism
contrast, not an estimate of route reliability.

## Accessibility text

Two side-by-side vertical timelines use the same Bumble-backed healthy case.
The left timeline resets the fixture, connects by BLE, reaches GATT subscription
readiness, crosses the stimulus boundary, observes motion, sends a stop command,
observes a completed interval, and disconnects; it is a valid pass. The right
timeline resets and connects by BLE but remains connecting at the readiness
check, never crosses the stimulus boundary, and disconnects during teardown; it
is invalid and not behaviorally evaluated.

## Reproduction

The sanitized data table and SVG are generated directly from the two immutable
run records:

```powershell
cd automation
npm run representatives:generate
npm run representatives:check
```

The machine-readable sources are
`automation/evidence/representatives/pilot-v1-lifecycle-timelines.json` and
`pilot-v1-lifecycle-timelines.csv`. The vector figure is
`docs/figures/representative-lifecycles.svg`.
