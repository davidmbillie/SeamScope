# SeamScope peripheral firmware

The sketch targets the Arduino Nano ESP32 and implements two deliberately
separate channels:

- USB serial controls the fixture and reports instrumentation events.
- BLE notifications carry the observation consumed by the Android app.

Compile from the sketch directory:

```powershell
arduino-cli compile --profile nano_esp32 .
```

After selecting the board's port, upload with:

```powershell
arduino-cli upload --profile nano_esp32 --port COM5 .
```

The protocol is documented in [../docs/protocol.md](../docs/protocol.md). The
firmware does not emulate a vehicle, ECU, ELD, or regulated data source.
