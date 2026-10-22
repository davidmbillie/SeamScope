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

## IST gate

Draft an IST Short Communication only if the work can demonstrate at least one
non-obvious classification produced by the procedure and obtain independent
evidence that its decision records expose or resolve ambiguity better than an
unstructured "mock, simulator, or hardware" judgment.
