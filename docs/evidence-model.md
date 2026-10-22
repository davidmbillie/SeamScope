# Evidence model

## Claim ladder

| Claim | Injected route | Serial/BLE route |
|---|---|---|
| The state rule maps supplied values to the expected state | In scope | In scope |
| The UI represents the application state correctly | In scope | In scope |
| The app decodes the configured BLE payload | Bypassed | In scope |
| BLE notifications arrive with relevant ordering/freshness | Bypassed | In scope for the tested cases |
| The Arduino represents a vehicle, ECU, or ELD faithfully | Out of scope | Out of scope |
| The complete system complies with a regulation | Out of scope | Out of scope |

Passing the same behavioral assertion through both routes does not make the
routes equivalent. It establishes agreement only for the executed cases and the
observed response.

## Why the runner is hardware-attached

The physical-path experiment requires a process with access to:

- the Arduino USB serial interface;
- an Android handset through ADB/Appium; and
- the local BLE path between the peripheral and handset.

The host may be bare metal or a virtual machine with validated device
passthrough. The scientific boundary is physical-path access, not the marketing
label attached to the host.

## Control and evidence channels

- **USB serial** is a control and instrumentation channel. It commands the
  fixture and records acknowledgements.
- **BLE** is the path being included in the broader integration evidence claim.
- **Appium** observes the application response through the Android UI automation
  boundary.
- **Run artifacts** join commands, peripheral transmissions, and UI observations
  using a run identifier and sequence numbers.

