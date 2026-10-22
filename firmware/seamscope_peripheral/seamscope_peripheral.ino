#include <Arduino.h>
#include <BLEDevice.h>
#include <BLE2902.h>
#include <BLEServer.h>
#include <BLEUtils.h>

namespace {
constexpr char kDeviceName[] = "SeamScope Peripheral";
constexpr char kServiceUuid[] = "7f5a1000-5e4d-4d58-9f6b-8a8e70d86a01";
constexpr char kObservationUuid[] = "7f5a1001-5e4d-4d58-9f6b-8a8e70d86a01";

BLECharacteristic* observationCharacteristic = nullptr;
String input;
float speed = 0.0F;
uint32_t sequence = 0;
bool dropNext = false;
bool malformNext = false;

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) {
    Serial.println("BLE CONNECTED");
  }

  void onDisconnect(BLEServer*) {
    Serial.println("BLE DISCONNECTED");
    BLEDevice::startAdvertising();
  }
};

class ObservationCallbacks : public BLECharacteristicCallbacks {
  void onStatus(BLECharacteristic*, Status status, uint32_t code) {
    Serial.print("BLE NOTIFY STATUS ");
    Serial.print(static_cast<int>(status));
    Serial.print(" CODE ");
    Serial.println(code);
  }
};

void printSpeed(float value) {
  Serial.print(value, 1);
}

void publishObservation() {
  sequence += 1;
  if (dropNext) {
    dropNext = false;
    Serial.print("DROP ");
    Serial.println(sequence);
    return;
  }

  String payload;
  if (malformNext) {
    malformNext = false;
    payload = "speed=not-a-number;sequence=" + String(sequence);
    Serial.print("MALFORM ");
    Serial.println(sequence);
  } else {
    payload = "speed=" + String(speed, 1) + ";sequence=" + String(sequence) +
              ";sentAtMs=" + String(millis());
    Serial.print("TX ");
    Serial.print(sequence);
    Serial.print(" SPEED ");
    printSpeed(speed);
    Serial.println();
  }

  observationCharacteristic->setValue(payload.c_str());
  observationCharacteristic->notify();
}

void handleCommand(String command) {
  command.trim();
  if (command == "RESET") {
    speed = 0.0F;
    sequence = 0;
    dropNext = false;
    malformNext = false;
    // Reset the cached GATT value as well as the sketch's local variables so
    // a prior run cannot leak into later inspection or a future client read.
    observationCharacteristic->setValue(
        "speed=0.0;sequence=0;sentAtMs=0");
    // RESET establishes the transport precondition as well as the data state,
    // making a run independent of the previous BLE connection lifecycle.
    BLEDevice::startAdvertising();
    Serial.println("BLE ADVERTISING");
    Serial.println("OK RESET");
    return;
  }

  if (command.startsWith("SPEED ")) {
    const String value = command.substring(6);
    const float parsed = value.toFloat();
    if (parsed < 0.0F || (parsed == 0.0F && value != "0" && value != "0.0")) {
      Serial.println("ERROR INVALID_SPEED");
      return;
    }
    speed = parsed;
    Serial.print("OK SPEED ");
    printSpeed(speed);
    Serial.println();
    publishObservation();
    return;
  }

  if (command == "FAULT DROP_NEXT") {
    dropNext = true;
    Serial.println("OK FAULT DROP_NEXT");
    return;
  }

  if (command == "FAULT MALFORM_NEXT") {
    malformNext = true;
    Serial.println("OK FAULT MALFORM_NEXT");
    return;
  }

  if (command == "STATUS") {
    Serial.print("STATUS SPEED ");
    printSpeed(speed);
    Serial.print(" SEQUENCE ");
    Serial.println(sequence);
    return;
  }

  Serial.println("ERROR UNKNOWN_COMMAND");
}
}  // namespace

void setup() {
  Serial.begin(115200);
  input.reserve(96);

  BLEDevice::init(kDeviceName);
  BLEServer* server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  BLEService* service = server->createService(kServiceUuid);
  observationCharacteristic = service->createCharacteristic(
      kObservationUuid, BLECharacteristic::PROPERTY_READ |
                            BLECharacteristic::PROPERTY_NOTIFY);
  observationCharacteristic->addDescriptor(new BLE2902());
  observationCharacteristic->setCallbacks(new ObservationCallbacks());
  observationCharacteristic->setValue(
      "speed=0.0;sequence=0;sentAtMs=0");
  service->start();

  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  // Keep each legacy BLE payload within its 31-byte limit. The ESP32
  // library's convenience scan-response path copies the 128-bit service UUID
  // into the scan response before adding this 20-character name, which makes
  // configuration fail and prevents advertising from starting.
  BLEAdvertisementData advertisementData;
  advertisementData.setFlags(ESP_BLE_ADV_FLAG_GEN_DISC |
                             ESP_BLE_ADV_FLAG_BREDR_NOT_SPT);
  advertisementData.setCompleteServices(BLEUUID(kServiceUuid));
  advertising->setAdvertisementData(advertisementData);

  BLEAdvertisementData scanResponseData;
  scanResponseData.setName(kDeviceName);
  advertising->setScanResponseData(scanResponseData);
  BLEDevice::startAdvertising();

  Serial.println("READY SEAMSCOPE_PERIPHERAL");
}

void loop() {
  while (Serial.available() > 0) {
    const char next = static_cast<char>(Serial.read());
    if (next == '\n') {
      handleCommand(input);
      input = "";
    } else if (next != '\r') {
      input += next;
      if (input.length() > 95) {
        input = "";
        Serial.println("ERROR COMMAND_TOO_LONG");
      }
    }
  }
  delay(2);
}

