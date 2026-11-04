# Provisional paper identity

## Research question

For a specified cyber-physical software subclaim, assurance target, evidence
claim, and test environment, what conditions determine whether off-device
execution provides adequate test evidence?

## Provisional contribution

An assurance-target-aware procedure that decomposes a requirement into atomic
claims, identifies physical properties capable of changing each verdict, and
requires every such property to be observed or represented through a
claim-appropriate validated seam before the resulting evidence is classified as
virtual, hybrid, or physical-path evidence.

## Unit of analysis

The classification attaches to this tuple:

```text
(subclaim, assurance target, evidence claim, environment, configuration, time)
```

It does not attach permanently to an API, framework, platform, or requirement.

## SeamScope's role

SeamScope is a deliberately small executable counterexample to evidence-scope
inflation. It can show that:

1. direct semantic injection can support a threshold-logic claim;
2. the same result does not by itself support BLE encoding, delivery, ordering,
   or freshness claims; and
3. a hardware-attached route can exercise those additional properties.

## Explicit nonclaims

SeamScope does not establish:

- regulatory compliance;
- vehicle-speed or ECM provenance;
- equivalence to an ELD or commercial product;
- realistic RF behavior across environmental conditions;
- universal superiority of physical testing; or
- cross-domain validity of the proposed decision procedure.

## Historical IST drafting gate

During early scoping, a prospective gate required both a non-obvious
classification and independent evidence that structured decision records
resolved ambiguity better than an unstructured "mock, simulator, or hardware"
judgment. The final manuscript adopted a narrower contribution: it demonstrates
different claim dispositions for equal passing outcomes and supplies an
inspectable, machine-readable record, while explicitly not claiming independent
analyst agreement or improved decisions. An independent reader comparison is
future evaluation, not a requirement satisfied by the v1.0.0 artifact.
