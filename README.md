# SeamScope

SeamScope is a minimal, reproducible cyber-physical mobile testbed for studying
**what a test result is evidence of**.

The same Appium scenario can drive two signal routes:

- an **injected route** that supplies a semantic observation through a software
  seam; and
- a **serial/BLE route** in which a hardware-attached runner commands an Arduino
  over USB serial and the Arduino delivers the observation to an Android app over
  Bluetooth Low Energy.

The routes may produce the same visible behavior, but they exercise different
parts of the evidence path. SeamScope exists to make that difference inspectable.

## Status

This repository is an early research fixture, not an Electronic Logging Device,
ECU emulator, compliance product, or compliance test suite.

Implemented in the first slice:

- React Native 0.87 Android application with stable accessibility identifiers;
- a pure, unit-tested motion-state model;
- deep-link injection (`seamscope://signal?...`) as the software substitution
  seam;
- WebdriverIO/Appium scenario, page objects, and swappable rig controllers;
- newline-delimited serial protocol and an Arduino BLE-peripheral sketch;
- a native Android BLE adapter validated on both a physical tablet and a
  Bumble-backed Android emulator;
- a hybrid route through the emulator HCI boundary, a physical USB Bluetooth
  controller, and the Nano ESP32; and
- evidence-boundary and clean-room design notes.

## Architecture

```text
                         same scenario
                              |
                    +---------+---------+
                    |                   |
            InjectedSignalRig    SerialBleSignalRig
                    |                   |
             Android deep link       USB serial
                    |                   |
             React Native app    Arduino peripheral
                    |                   |
                    |              BLE observation
                    +---------+---------+
                              |
                      observable app UI
                              |
                    Appium / UiAutomator2
```

Serial is the laboratory control channel. BLE is part of the physical evidence
path. Appium observes application behavior; it does not own hardware control.

## Repository layout

```text
apps/mobile/              React Native Android application
automation/               WebdriverIO, page objects, scenarios, rig controllers
firmware/seamscope_peripheral/
                          Arduino serial/BLE peripheral
docs/                     Research scope, protocol, and evidence notes
```

## Quick start: injected route

Prerequisites are Node.js 22+, Android Studio/SDK, JDK 17+, and an Android
emulator or device.

```powershell
cd apps/mobile
npm install
npm run android
```

In another shell, after the app is installed:

```powershell
adb shell am start -W -a android.intent.action.VIEW `
  -d "seamscope://signal?speed=8&sequence=1" com.seamscope
```

The application should move from **Activity Log** to **In Motion**. Send a later
sequence with speed zero to close the interval.

See [docs/getting-started.md](docs/getting-started.md) for the complete local
setup and [docs/evidence-model.md](docs/evidence-model.md) for what each route
does and does not support.

The validated emulator-to-physical-controller setup and its observed boundary
failures are recorded in [docs/bumble-route.md](docs/bumble-route.md).

The bounded first study is specified in
[docs/experiment-plan.md](docs/experiment-plan.md).

The completed frozen-study accounting and bounded interpretation are in
[docs/interim-results.md](docs/interim-results.md). The source-separated figure
for the sole valid confirmatory failure is documented in
[docs/sequence46-evidence-chain.md](docs/sequence46-evidence-chain.md).

The paper's lightweight, SACM-compatible verdict projection is implemented as
an illustrative machine-readable companion in
[automation/evidence/claim-assessments/](automation/evidence/claim-assessments/README.md).
It separates execution validity, ordinary test outcome, and claim disposition
across two claims and two passing routes; it is not proposed as a standard.

For daily development, open [SeamScope.code-workspace](SeamScope.code-workspace)
and follow [docs/vscode-workflow.md](docs/vscode-workflow.md).

The checked-in Android debug keystore is a conventional development key that
supports reproducible local debug builds. It must not be used to sign a
production release.

## Project rule

> Include no component unless it changes the evidence claim.

Internally, this is known as the “enough almonds” rule.

## License

SeamScope is available under the [MIT License](LICENSE).
