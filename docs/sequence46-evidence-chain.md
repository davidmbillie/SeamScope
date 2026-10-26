# Sequence 46 evidence-chain figure

## Selection purpose

This figure explains the sole valid confirmatory failure. It is not a failure-
frequency graphic and does not imply that this record is statistically
representative of the Bumble route.

The record was selected by an outcome-independent rule: it is the only frozen
confirmatory run classified `valid / fail`. Unlike a setup-invalid attempt, it
crossed the declared stimulus boundary and therefore had to remain an outcome
without retry. Its fixture, application, Appium, and Bumble evidence is
complete, and the integrity audit byte-verified its 278,999-byte Bumble slice.

## Paper-facing caption

**Figure X. Source-separated evidence chain for the sole valid confirmatory
failure.** The Bumble-backed run first behaved as intended: sequence 1 was
deliberately dropped and produced no observed application transition, while
sequence 2 later became observable as In Motion after callback `status=1,
code=0`. The physical BLE link disconnected before completion. Although the
fixture accepted the sequence-3 speed-zero command, the later callback was
`status=5, code=0`, and Appium did not observe a completed interval within
2,000 ms. The run remained a valid failure because route-specific evidence
corroborated command acceptance after the pre-invocation marker. Event offsets
are runner-observed and do not synchronize the source clocks.

## Accessibility text

A four-lane event diagram separates runner, fixture and BLE, Appium-observed
application state, and Appium-verdict observations. The runner issues sequence
1, which the fixture deliberately drops. Appium observes no transition during
the negative window. The runner issues sequence 2; the fixture records callback
`status=1, code=0`, then the physical BLE link disconnects. Appium subsequently
observes the sequence-2 In Motion state. The runner issues sequence 3 to stop
motion, after which the fixture records callback `status=5, code=0`. Appium then
fails to observe the completed interval. The record is classified valid and
failed at the BLE boundary. No undocumented meaning is assigned to either
numeric callback field.

## Main-text allocation

Use this as the empirical mechanism figure if the Short Communication permits
two figures. The architecture and claim-boundary diagram should remain the
conceptual figure. Retain `representative-lifecycles.svg`, which contrasts a
valid pass with a setup-invalid lifecycle, in the artifact or supplement.
That earlier graphic remains useful for apparatus-readiness interpretation but
is less central than an actual valid failure once the completed dataset is
available.

## Reproduction

The JSON, CSV, and SVG are generated from the immutable normalized events and
verdict for `c046-bumble-dropped-r10-retry01`:

```powershell
cd automation
npm run failure-chain:generate
npm run failure-chain:check
```

The generated machine-readable sources are stored under
`automation/evidence/representatives`; the vector figure is
`docs/figures/sequence46-evidence-chain.svg`.
