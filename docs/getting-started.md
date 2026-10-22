# Getting started

## Pinned baseline

- React Native 0.87.0
- Node.js 22.11 or newer
- Android-only first milestone
- Appium 3 with the official UiAutomator2 driver
- WebdriverIO with TypeScript

## Local environment

On Windows, set these for the current shell if they are not configured globally:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $null # avoid a deprecated, conflicting SDK path
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:Path"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
```

## Mobile application checks

```powershell
cd apps/mobile
npm test -- --runInBand
npm run lint
cd android
.\gradlew.bat assembleDebug
```

## Automation checks

```powershell
cd automation
npm install
npm run typecheck
```

## Firmware check

```powershell
cd firmware/seamscope_peripheral
arduino-cli compile --profile nano_esp32 .
```

The end-to-end suite requires a running emulator or attached device and a local
Appium/UiAutomator2 installation. Select the route with:

```powershell
$env:SEAMSCOPE_RIG = "injected" # or "serial"
$env:SEAMSCOPE_SERIAL_PORT = "COM5" # serial route only
npm run test:e2e
```

The injected route is executable before the BLE adapter is added. The serial
route currently validates the runner-to-peripheral control boundary; its full
end-to-end scenario intentionally remains gated on the native Android BLE
adapter.
