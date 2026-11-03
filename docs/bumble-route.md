# Bumble HCI bridge route

The hybrid route has been executed successfully. It is a boundary case between
semantic injection and the physical-tablet reference route:

```text
Appium -> Android emulator -> Android BLE host stack -> packet-streamer HCI
       -> Bumble HCI bridge -> physical USB Bluetooth controller -> BLE radio
       -> Nano ESP32 GATT peripheral

Windows serial controller ---------------------------------------> Nano ESP32
```

Calling this route either "virtual" or "physical" would erase the distinction
SeamScope is intended to expose. The Android device and controller attachment
are virtualized, while the USB controller, radio link, peripheral, and serial
control channel are physical.

## Validated configuration

- Android emulator `33.1.21.0`, `Pixel_6` AVD, Android 14 / API 34, x86_64;
- Bumble `0.0.179.dev18+g9bf2e03`;
- Bumble host transport `android-netsim:_:8877,mode=controller`;
- Bumble controller transport selected by USB vendor/product identity and a
  runtime-supplied controller serial (ASUS USB-BT500 hardware identity, rather
  than enumeration order);
- Realtek RTL8761BU controller firmware `rtl8761bu_fw.bin`, 44,484 bytes,
  firmware version `0xDFC6D922`, project ID `0x000E`;
- Nano ESP32 on a runtime-selected Windows serial port; and
- the same WebdriverIO/Appium scenario and `SerialBleSignalRig` used by the
  physical-tablet route.

The Realtek files are downloaded into the ignored `.cache/rtk_fw` directory;
they are not repository artifacts. Obtain them with Bumble's firmware utility:

```powershell
New-Item -ItemType Directory -Force .cache\rtk_fw
bumble-rtk-fw-download `
  --output-dir .cache\rtk_fw `
  --single rtl8761bu `
  --source linux-from-scratch `
  --parse
```

Start the bridge before starting the emulator:

```powershell
$env:BUMBLE_RTK_FIRMWARE_DIR = "$PWD\.cache\rtk_fw"
$env:BUMBLE_LOGLEVEL = "WARNING"
$env:SEAMSCOPE_BUMBLE_CONTROLLER_TRANSPORT = `
  "usb:0B05:190E/<controller-serial>"
bumble-hci-bridge `
  android-netsim:_:8877,mode=controller `
  $env:SEAMSCOPE_BUMBLE_CONTROLLER_TRANSPORT
```

When a persistent serial daemon owns the selected serial port, the test runner connects to its TCP
endpoint with `SEAMSCOPE_SERIAL_DAEMON_PORT` (currently `8765`). Do not put that
TCP port in `SEAMSCOPE_SERIAL_PORT`; the latter names a Windows device such as
`COM7` and is used only when the runner owns the serial bridge directly. Daemon
mode no longer requires `SEAMSCOPE_SERIAL_PORT` to be set.

In a second terminal, start exactly one emulator instance:

```powershell
$env:ANDROID_AVD_HOME = "D:\SeamScope\android-avd"
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" `
  -packet-streamer-endpoint localhost:8877 `
  -avd Pixel_6 `
  -no-snapshot
```

The `D:` location is a machine-local storage choice made after the system
drive became a collection risk; it is not a protocol requirement. The AVD's
pointer file and data directory must move together, and `ANDROID_AVD_HOME`
must identify the directory containing both. A collection session records the
resolved AVD location but does not interpret drive choice as an experimental
factor.

For resource-constrained unattended collection, the validated launch adds
`-no-window -gpu swiftshader_indirect -no-boot-anim -no-snapshot`. `-no-window`
without the explicit software renderer failed while creating the GLES
framebuffer on this host. This launch choice changes executor presentation and
rendering implementation, not the Android API level or the exercised BLE
path.

Before running Appium, verify exactly one
`qemu-system-x86_64-headless` backend, one established connection to port
`8877`, an `emulator-5554` ADB target, and Bluetooth state `ON`. Duplicate or
orphaned emulator backends can separate ADB visibility from packet-streamer
ownership and create misleading symptoms. ADB can show only one device while
additional QEMU processes remain alive.

On this host, set `ANDROID_EMULATOR_HOME` to a known writable directory before
launching the emulator. The default emulator metadata home produced a host
file-lock error (`Unexpected error while creating: C (error: 3)`) before ADB
startup. This setting relocates emulator bookkeeping; it does not relocate or
modify the AVD:

```powershell
$env:ANDROID_EMULATOR_HOME = "$PWD\.cache\android-emulator-home"
New-Item -ItemType Directory -Force $env:ANDROID_EMULATOR_HOME
```

The API 34 emulator could not reach Metro through its automatic `10.0.2.2`
gateway during the 2026-10-21 calibration session. The debug app therefore
used `debug_http_host=127.0.0.1:8081` with
`adb reverse tcp:8081 tcp:8081`. This is executor provisioning for the debug
bundle path, not part of the BLE treatment.

## First successful hybrid execution

On 2026-10-12, the common motion scenario completed through the full route:

1. the serial bridge opened COM3 and the peripheral acknowledged `RESET`;
2. Android discovered, connected to, and subscribed to the SeamScope GATT
   characteristic;
3. serial `SPEED 8` produced peripheral sequence 1, successful notification
   status, and an Appium-observed speed of `8.0` in the motion view;
4. serial `SPEED 0` produced sequence 2 and returned the UI to the activity-log
   view; and
5. Appium observed the completed-interval count change from `0` to `1`.

WebdriverIO reported one passing test in 14.9 seconds (22 seconds for the full
runner invocation).

## Failures exposed while establishing the route

These failures belong to different layers and must not be collapsed into a
single claim that "hardware is flaky":

| Observation | Classification | Consequence |
|---|---|---|
| The ESP32 convenience advertising configuration combined a 128-bit UUID, 20-character name, and transmit-power field in an oversized legacy scan response. | Firmware/API integration defect | The library returned before starting advertising, while the sketch printed a misleading success message. Explicit advertisement and scan-response payloads fixed it. |
| The USB controller ran without `rtl8761bu_fw.bin`. | Executor/controller provisioning defect | Android discovered and connected to the Nano, but GATT service discovery timed out with status 8. Loading the mapped firmware made the unchanged test pass. |
| Two `Pixel_6` processes targeted the same endpoint. | Test-environment lifecycle defect | The bridge and ADB could refer to different emulator instances; one clean cold start restored an unambiguous route. |
| A stopped Bumble process retained the USB handle. | Test-tool resource-lifecycle defect | Later scans failed with `LIBUSB_ERROR_ACCESS` until only the orphaned process tree was stopped. |
| Windows intermittently refused to reopen COM3 until the Nano was reconnected. | Fixture/executor reliability event | The scenario failed before BLE was exercised and therefore supplied no BLE verdict. |
| A mandatory characteristic read immediately followed notification registration. | Application/protocol integration defect | Service discovery, MTU negotiation, and the CCCD write succeeded, but the extra read stalled until Android reported GATT status 133. Because the protocol resets the fixture and sends no stimulus before subscription readiness, removing the redundant read made the observation boundary both narrower and more reliable. |
| Manual exploration, Fast Refresh, and failed setup attempts left prior BLE-client state in the debug app. | Test-application lifecycle defect | Clearing only the disposable SeamScope app state, granting nearby-device permission, and starting one fresh process restored an unambiguous client lifecycle. The runner now disconnects any pre-existing subscription before resetting application state. |
| Clearing app data exposed Android's nearby-device consent sheet. | Executor provisioning event | The system overlay hid application elements from Appium. The run was marked invalid before stimulus, permission was granted explicitly, and teardown was made tolerant of system overlays. |

Ambient scans also observed numerous nearby advertisements, including an ELD.
That establishes a crowded local BLE environment, but it is not evidence that
RF interference caused any failure; no interference measurement was performed.

## Evidence scope

The successful hybrid run directly exercised the Android BLE host stack, HCI
commands and ACL data, a physical USB controller, radio discovery and
connection, the Nano GATT server, notification delivery, application parsing,
and the Appium-visible state transition. It did not establish equivalence to a
specific handset controller, characterize RF performance, validate arbitrary
USB controllers, or prove that the route is generally more reliable than the
physical-tablet route.

The most useful observation is methodological: adding the hybrid boundary made
configuration and integration faults observable that semantic injection could
not expose. The resulting failures are evidence only after they are localized
to the executed layer and separated from unrelated run-level confounders.

## Consecutive-run calibration

After the application and runner lifecycle fixes, two healthy-threshold runs
passed in succession. The second run required no intervening reset of Android
Bluetooth, Bumble, the emulator, Nano, or app data. It subscribed in about
2.25 seconds, displayed speed `8.0` about 0.77 seconds after the serial
stimulus, displayed one completed interval about 0.75 seconds after the stop
stimulus, and returned the BLE route to `IDLE` during teardown. These are
calibration observations, not yet frozen timeout thresholds or population-level
performance estimates.

### Timeout and lifecycle calibration on 2026-10-20

A later calibration session separated performance targets from harness failure
limits:

- subscription target: 3,000 ms; hard harness limit: 8,000 ms;
- post-stimulus display target: 1,000 ms; hard harness limit: 2,000 ms; and
- dropped-notification negative-observation window: 2,000 ms.

Observed valid display transitions remained below the 1,000 ms target in this
session. Subscription was more variable: a warm valid run subscribed in about
1.83 seconds, while valid runs following an Android Bluetooth reset took about
3.70 to 4.14 seconds. Consequently, the 3-second value remains a provisional
performance target rather than a validity cutoff; the 8-second limit is the
appropriate calibration harness bound.

The session also falsified the assumption that an application-visible `IDLE`
state guarantees an indefinitely reusable hybrid apparatus. Android logs
confirmed notification teardown, GATT close, and eventual ACL disconnection,
yet later connections could stall during service discovery. A 500 ms delay
between connection and service discovery did not prevent the failure and was
therefore removed. Cycling Android Bluetooth recovered one run, but did not
reliably establish the next one; restarting Bumble and the USB controller was
also insufficient once the persistent failure recurred. Finally, reopening
the Nano's serial owner failed with Windows reporting that the attached device
was not functioning, requiring a physical Nano reconnect.

After that reconnect, Android Bluetooth initially remained off because the
Bumble listener was TCP-connected but its USB controller did not answer the
Android HCI `RESET` command. Android's Bluetooth process timed out and crashed.
Reopening Bumble again restored a responsive controller and allowed the
remaining behavioral cases to proceed. This distinguishes three readiness
claims that must not be conflated: packet-streamer connectivity, HCI controller
responsiveness, and GATT application readiness.

These are setup-validity observations, not failed application-behavior trials:
no motion or fault stimulus had been issued in the affected runs. They show
that apparatus lifecycle is a measured part of this hybrid route and that a
green application teardown indicator is weaker evidence than end-to-end
reusability. The evidence schema now includes an `apparatus-reset` event so an
automated reset can be declared without misclassifying it as manual
intervention.

### Retained Bumble/BLE dry runs on 2026-10-21

The finalized capture path produced one valid, passing non-confirmatory dry
run for each Bumble/BLE case:

| Run | Observation | Recorded timings |
|---|---|---|
| `dryrun-healthy-bumble-001` | Motion at sequence 1, then one completed interval at sequence 2 | subscription 5,687.7 ms; motion 800.8 ms; completion 784.6 ms |
| `dryrun-dropped-bumble-001` | `DROP 1`; no transition for 2,000 ms; recovery at sequence 2; completion at sequence 3 | subscription 2,025.1 ms; recovery 834.0 ms; completion 808.7 ms |
| `dryrun-malformed-bumble-002` | `MALFORM 1`; visible rejection with no interval; recovery at sequence 2; completion at sequence 3 | subscription 2,448.5 ms; rejection 893.8 ms; recovery 834.2 ms; completion 766.6 ms |

The healthy subscription missed the 3,000 ms performance target but remained
inside the frozen 8,000 ms harness limit; this is a descriptive calibration
observation, not an invalid run. All recorded post-stimulus transitions met the
1,000 ms performance target and the 2,000 ms harness limit.

`dryrun-malformed-bumble-001` remains archived as
`invalid / not-evaluated`. The runner was given `8765` as though it were the
physical serial-port name, so its local bridge rejected the value before any
stimulus. The retry uses a new run identifier and points back to that attempt.
This failure does not support a BLE or application verdict, but it does provide
a reconstructable example of executor configuration failure before the
validity boundary.

For all three valid runs, the app returned to `IDLE`, the firmware reported
`BLE DISCONNECTED`, WDIO exited, and the managed Appium child released port
4723 without a manual process stop. The managed runner is now the required
Windows execution path for unattended collection.

### Freeze-candidate capture and stop-rule exercise on 2026-10-21

`dryrun-capture-bumble-004` validated the complete per-run capture path. It is
a valid, passing healthy dry run with a reconstructable manifest, normalized
events, verdict, Appium transcript, fresh logcat, an exact byte slice from the
active Bumble session, serial observations, and start/final screenshots. It
subscribed in about 4.14 seconds, displayed motion about 0.94 seconds after the
first stimulus, and displayed the completed interval about 0.79 seconds after
the stop stimulus. The values are calibration observations, not confirmatory
estimates.

The first version of that run closed the per-run serial collector just before
the asynchronous firmware disconnect line arrived. The firmware line was
present in the persistent daemon log, but not the run-local record. Teardown
now waits up to 2,000 ms for `BLE DISCONNECTED` and records it before closing;
the next GATT attempts demonstrated that the run-local serial record retains
both connection and disconnection events.

The subsequent attempts exercised the declared recovery and stopping policy:

| Run | Classification | Observation |
|---|---|---|
| `dryrun-capture-bumble-005` | `invalid / not-evaluated`, BLE setup | Android reported `GATT_CONN_TIMEOUT`/status 8 before stimulus. |
| `dryrun-capture-bumble-006` | `invalid / not-evaluated`, BLE setup | The same condition recurred after an Android Bluetooth cycle. |
| `dryrun-capture-bumble-007` | `invalid / not-evaluated`, application setup | During the clean emulator/Bumble restart, Android displayed `System UI isn't responding`; the app missed its fixed 45-second readiness bound and GATT was not evaluated. |
| `dryrun-capture-bumble-008` | `invalid / not-evaluated`, BLE setup | After software application recovery, the same GATT condition recurred. This was the third consecutive evaluation of that condition, so the session stopped. |

The retained transport traces localize the recurring GATT condition more
precisely than the Android status alone. In the passing run, the host's
`ATT_FIND_INFORMATION_REQUEST` for handles `0x0004` through `0x0005` received
an `ATT_FIND_INFORMATION_RESPONSE`. In run 008, earlier discovery exchanges
succeeded and the host issued the same request, but no response crossed the
observed controller boundary before `HCI_CONNECTION_TIMEOUT_ERROR`. This is
boundary localization, not a demonstrated root cause in the Nano, radio,
controller, Bumble, or Android stack.

The post-stop readiness snapshot
`artifacts/evidence/pilot-v1/sessions/readiness-post-stop-20261021-2142.json`
still marks serial, Bumble TCP, HCI command completion, and Android Bluetooth
as ready while correctly deferring GATT. That is a useful negative result for
the layered model: green lower-layer checks do not imply that the next GATT
discovery exchange will complete.

Run 007 also showed that WebdriverIO's implicit polling cadence could generate
roughly 20 element queries per second on a constrained cold emulator. The
runner now uses an explicit 500 ms cadence for application-control readiness;
the 45-second application limit is unchanged. The readiness script likewise
searches the bounded current Bumble session file for an HCI command-complete
event instead of an arbitrary 2,000-line tail, which dense advertising reports
could displace. Both are executor corrections made before protocol freeze.

### Repeatable-readiness calibration on 2026-10-21

A later calibration session separated physical-device serviceability from the
hybrid route. `calibration-isolation-tablet-001` passed immediately against the
same Nano after a hybrid GATT failure, so the retained evidence localizes the
condition to the emulator--Bumble--USB-controller route without assigning a
root cause to one component.

The session then found two headless QEMU backends left by failed emulator
launches even though ADB listed only `emulator-5554`. Removing both orphans,
while preserving the ADB-visible packet-streamer owner and leaving the Nano and
USB-BT500 untouched, changed the next outcome from GATT timeout to a complete
pass. The following unchanged warm lifecycles produced mixed outcomes:

| Run | Classification | Observation |
|---|---|---|
| `calibration-gatt-007` | `valid / pass` | Recovery run; subscribed in about 2.32 seconds and completed the motion interval after the declared orphan-backend cleanup. |
| `calibration-gatt-008` | `valid / fail`, post-stimulus BLE observation | Subscription succeeded in about 3.83 seconds; the fixture reported notification success, but Android received no characteristic-value update and the UI did not transition. |
| `calibration-gatt-009` | `valid / pass` | The unchanged warm lifecycle completed end to end without intervention. |
| `calibration-gatt-010` | `invalid / not-evaluated`, BLE setup | The next unchanged lifecycle connected but did not reach `SUBSCRIBED`; no stimulus was issued. |

Thus unique emulator ownership is a necessary readiness condition and has been
added to `check-readiness.ps1`, but it is not sufficient for durable GATT or
notification repeatability. The session restored and demonstrated multiple
successful subscriptions, while also falsifying the stronger proposition that
the recovered route was ready for an uninterrupted confirmatory collection.
