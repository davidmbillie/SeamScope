# Peripheral protocol

The hardware-attached runner controls the Arduino using newline-delimited ASCII
over USB serial at 115200 baud.

## Commands

```text
RESET
SPEED <non-negative decimal>
FAULT DROP_NEXT
FAULT MALFORM_NEXT
STATUS
```

`RESET` clears speed, sequence, and armed fault state and restarts BLE
advertising so a scenario does not inherit the preceding connection lifecycle.
The fixture emits `BLE ADVERTISING` followed by `OK RESET`.

## Responses and events

```text
BLE ADVERTISING
OK RESET
OK SPEED <value>
TX <sequence> SPEED <value>
DROP <sequence>
MALFORM <sequence>
STATUS SPEED <value> SEQUENCE <sequence>
ERROR <reason>
BLE NOTIFY STATUS <status> CODE <native-code>
```

`OK` acknowledges command acceptance. `TX`, `DROP`, and `MALFORM` describe what
the peripheral did on the BLE evidence path. A test must not treat an `OK`
response as proof that an observation reached the application.

`BLE NOTIFY STATUS` is peripheral-side instrumentation emitted after an
attempted GATT notification. It is useful for locating a failed boundary, but
it likewise does not replace the application/UI observation.

## BLE contract

The provisional service exposes a single notified UTF-8 characteristic:

```text
speed=<decimal>;sequence=<unsigned integer>;sentAtMs=<unsigned integer>
```

UUIDs are defined once in the firmware and mobile adapter. They identify a
fictional research telemetry service and must not be replaced with proprietary
service identifiers.

The Android central requests ATT MTU 128 before enabling notifications. The
text payload is longer than the 20-byte value available with the default MTU;
without negotiation, the ESP32 BLE library truncates the notification and the
strict application parser rejects it. The negotiated MTU is displayed in the
application's BLE-route status so this transport precondition remains visible.

