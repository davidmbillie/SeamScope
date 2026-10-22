# First experiment plan

The remaining author decisions and proposed evidence schema are detailed in
[`pilot-protocol-decisions.md`](pilot-protocol-decisions.md).

The first study is a paired-route demonstration, not a performance benchmark.
Each case uses the same scenario assertion and records which boundary is
actually exercised.

## Experimental roles

The primary comparison holds the Pixel emulator, Android version, application
build, Appium scenario, page objects, and UI oracle constant. The manipulated
factor is the signal route:

1. semantic observation injection; or
2. serial-controlled BLE delivery through Bumble and the physical USB
   Bluetooth controller.

The Samsung tablet is a reference route, not one half of the primary pair.
Selected BLE cases are repeated on it to corroborate that the native adapter
and Arduino peripheral operate outside the emulator/HCI-bridge configuration.
Tablet observations are reported separately rather than pooled with emulator
observations.

| Case | Stimulus | Expected app observation | Why it matters |
|---|---|---|---|
| Threshold transition | 8, then 0 | Moving, then one completed interval | Establishes the shared behavioral claim |
| Stale sequence | Sequence 2, then 1 | Second observation is ignored | Shows an ordering-sensitive application rule |
| Dropped notification | Arm `DROP_NEXT`, then send 8 | No moving transition on the BLE route | Separates command acceptance from delivery evidence |
| Malformed notification | Arm `MALFORM_NEXT`, then send 8 | Payload is rejected and diagnosed | Exercises the app-side BLE decoding boundary |

## Run record

Every recorded run should include:

- repository commit and dirty-state flag;
- route, handset/emulator identity, Android version, and Appium versions;
- Arduino board/core version and firmware hash;
- monotonic run identifier and observation sequence numbers;
- serial acknowledgements and transmission events;
- assertion result and relevant UI hierarchy or screenshot; and
- deviations, retries, or manual interventions.

The injected and hardware-path results may be compared for behavioral
agreement, but the injected route must not be counted as evidence of BLE
encoding, notification delivery, ordering, or freshness.

## Paper gate

The existing injected, physical-tablet BLE, and hybrid-emulator executions are
apparatus-qualification evidence. They show that the routes are feasible but
are not the final comparative dataset. The fixture becomes comparative paper
evidence only after the protocol is frozen and the paired runs are repeatable
with retained artifacts. A useful paper result must do more than show that the
testbed works: it must demonstrate that the proposed classification procedure
changes, sharpens, or falsifies an evidence claim.
