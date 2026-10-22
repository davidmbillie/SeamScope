# VS Code workflow

Open [SeamScope.code-workspace](../SeamScope.code-workspace) rather than an
individual source directory. It presents the executable fixture and the IST
paper notebook in one window while keeping their files separate.

## Extensions

The workspace recommends a deliberately small set:

| Extension | Purpose | Local status when configured |
|---|---|---|
| React Native Tools | Launch/attach Hermes, React Native commands, Logcat | Not installed |
| ESLint | Inline mobile lint results and safe fixes | Not installed |
| Prettier | Uses the app's pinned Prettier for TS/TSX/JSON | Not installed |
| Jest | Test Explorer and per-test actions | Not installed |
| Arduino Community Edition | Board selection, verify, upload, IntelliSense generation | Installed |
| Microsoft C/C++ | Arduino C++ IntelliSense | Installed |
| Microsoft Serial Monitor | Interactive 115200-baud serial work | Installed |

VS Code should offer to install the missing recommendations when the workspace
opens. Android Studio remains the SDK, NDK, and Android Virtual Device manager;
VS Code is the daily editor, task runner, and debugger.

PlatformIO is intentionally not recommended. The project already has a small,
reproducible Arduino CLI profile, and a second embedded build system would add
configuration without changing the evidence claim.

## Android device run

1. Enable USB debugging, connect the tablet, and accept its authorization
   prompt if Android displays one.
2. In VS Code, run `Android: List devices` and confirm its device ID appears.
3. Run `Mobile: Start Metro` and leave that task running.
4. Run `Mobile: Run Android on device`, entering that device ID. The task builds
   only the connected device's active ABI, installs the app, and launches it.
5. For TypeScript/Hermes debugging, use `Android: Attach to Hermes` after the
   app is running. `Android: Launch with Hermes` combines those steps when the
   React Native Tools extension can identify the target directly.

If a previously installed debug build opens with a Metro connection error,
verify that Metro is listening on host port 8081 and recreate the device tunnel
before relaunching the app:

```powershell
adb -s <device-id> reverse tcp:8081 tcp:8081
adb -s <device-id> reverse --list
```

The expected listing contains `tcp:8081 tcp:8081`. This tunnel belongs to the
specific ADB device and may be absent even while another connected emulator has
working Metro access.

`ANDROID_HOME`, `ANDROID_SDK_ROOT`, the Android tools path, and Android Studio's
JDK are set for VS Code terminals by the workspace settings. This also prevents
the older machine-level `ANDROID_SDK_ROOT` from pointing Gradle at a different
SDK. The run task pins those values explicitly as well, so it does not depend on
whether its terminal was created before or after the workspace opened.

The machine-level defaults currently resolve to Microsoft JDK 11 and
`C:\Program Files (x86)\Android\android-sdk`. This project requires Java 17 or
newer, so use the workspace task rather than a previously opened external
terminal. The task uses Android Studio's bundled JBR and the current SDK under
`%LOCALAPPDATA%\Android\Sdk`; no global Java reconfiguration is required.

## Emulator run

Start the `Pixel_6` AVD manually from the SDK that owns it, then confirm it in
`Android: List devices`. An emulator build must use the x86_64 task below. When
both the emulator and tablet are connected, always provide an explicit device
ID; the Appium task does this through `SEAMSCOPE_DEVICE_UDID`.

## Arduino loop

1. Connect the Nano ESP32.
2. Run `Firmware: Compile Nano ESP32`.
3. Run `Firmware: Compile and upload` and enter its `COM` port.
4. Run `Firmware: Serial monitor`, use 115200 baud, and send `STATUS`, `RESET`,
   or `SPEED 8` followed by a newline.

The Arduino extension can also perform Verify and Upload from the Command
Palette. The checked-in tasks use the system Arduino CLI directly so their
behavior matches the documented command-line build.

Close every serial monitor before running the serial/Appium rig. Windows permits
only one process to own the `COM` port, so an open monitor will otherwise make
the test fail before it sends a command.

Moving the Nano between USB ports or cables invalidates any persistent serial
daemon that already owned it. If its log ends with `The port is closed` or a
new open reports `A device attached to the system is not functioning`, stop the
old daemon, verify the current COM assignment, and reconnect the Nano before
starting a fresh daemon. A successful uCon connection is a useful port check,
but uCon must then be closed so the daemon can acquire the port exclusively.

## Useful task groups

- `SeamScope: Verify source` runs unit tests, lint, both TypeScript checks, and
  the firmware compile in sequence.
- `Android: Assemble emulator debug APK` verifies an x86_64 native Android
  artifact without launching an emulator. It intentionally uses one worker and
  a bounded Gradle heap because this workstation has little free space on C:
  for paging during multi-architecture native builds.
- `Android: Assemble ARM64 device debug APK` produces the corresponding
  `arm64-v8a` artifact for the Samsung tablet. An x86_64-only APK cannot be
  installed on that device and fails with `INSTALL_FAILED_NO_MATCHING_ABIS`.
- `Automation: Injected Appium scenario` runs the software-seam route after the
  APK is installed and a device is available. Its device-ID prompt prevents it
  from drifting to the emulator when both Android targets are online.

`Automation: Physical serial/BLE Appium scenario` runs the same behavioral
assertions through the selected COM port, the Nano ESP32, BLE, and the selected
Android device. Close uCon and every other serial monitor first so the runner
can own the port.

For calibration only, `SEAMSCOPE_CONTROLLED_FAULT=DROP_NEXT` can be applied to
the healthy BLE scenario. The runner arms the fixture immediately before the
first motion stimulus, leaving the ordinary assertion and hard timeout intact.
This is intended to verify post-stimulus failure capture; it must be identified
as a controlled dry run and excluded from confirmatory results.

On Windows the TypeScript runner owns one long-lived PowerShell helper which in
turn uses .NET `SerialPort`. This is intentional: `serialport` 13 can leave USB
CDC devices unable to reopen with Windows error 31. The helper opens the port
once for the scenario, streams the peripheral's instrumentation back to the
runner, and closes it during teardown.
