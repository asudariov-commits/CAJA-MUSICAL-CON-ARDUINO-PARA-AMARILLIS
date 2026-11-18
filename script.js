/* ==========================================================================
   VOCES DE AMARILIS — Interactive Dual-MCU Workbench Runtime
   Generated cleanly with unabridged source files from D:\AntGra\Proteus\nuevo resultado\
   ========================================================================== */

(function () {
  "use strict";

  const SOURCE_FILES = {
  "nano": {
    "title": "firmware_maestro_nano.ino",
    "path": "D:\\AntGra\\Proteus\\nuevo resultado\\firmware_maestro_nano.ino",
    "lang": "cpp",
    "meta": "C++ / Arduino AVR (ATmega328P @ 16 MHz) · 537 líneas · Íntegro",
    "code": "/*\n * Firmware Maestro: Reproductor MP3 Tactil con Sincronizacion Audio-Video\n * MCU: Arduino Nano V3 (ATmega328P @ 5V, 16 MHz)\n *\n * Arquitectura Maestro-Esclavo:\n *   - Maestro (Arduino Nano): lee sensores tactiles TTP223, controla el modulo\n *     DFPlayer Mini por tramas binarias directas (7E FF 06 ... EF), monitorea el\n *     pin hardware BUSY (D12) para detectar el inicio/fin real del audio MP3 y\n *     envia comandos de sincronizacion al ESP32-C3.\n *   - Esclavo (ESP32-C3 SuperMini): recibe tramas UART, lee cuadros 128x64 (.bin)\n *     desde MicroSD SPI a 20 MHz y los muestra en OLED SSD1306 I2C a 800 kHz.\n *\n * Mapa de Pines Verificado:\n *   - D2  <- TTP223 #1 (SIG): Play / Pause      (activo en HIGH)\n *   - D3  <- TTP223 #2 (SIG): Siguiente Pista   (activo en HIGH)\n *   - D4  <- TTP223 #3 (SIG): Pista Anterior    (activo en HIGH)\n *   - D5  <- TTP223 #4 (SIG): Corto = Mute/Unmute | Largo (>=800ms) = Vol+ ciclico\n *   - D6  -> Divisor resistivo 5V->3.3V (1k/2k) -> ESP32-C3 GPIO20 (RX)\n *   - D7  <- ESP32-C3 GPIO21 (TX, 3.3V directo; V_IH ATmega328P = 3.0V -> OK)\n *   - D10 <- DFPlayer Pin 3 (TX, 3.3V directo)\n *   - D11 -> Resistencia 1k ohm -> DFPlayer Pin 2 (RX)\n *   - D12 <- DFPlayer Pin 16 (BUSY: LOW = reproduciendo audio, HIGH = detenido)\n *\n * Nota sobre velocidad UART (SYNC_BAUD):\n *   - Configurado a 115200 bps por defecto para coincidir con HardwareSerial0 del\n *     ESP32-C3. La transmision (TX) en tramas cortas es precisa a 115200 bps;\n *     si hubiera ruido por cables largos en RX/TX con SoftwareSerial en AVR,\n *     cambiar SYNC_BAUD a 38400UL en ambos firmwares.\n *\n * Reglas de seguridad electrica:\n *   1. Nunca activar INPUT_PULLUP en D7, D10 o D12 (conectados a pines de 3.3V).\n *   2. Usar divisor resistivo (p.ej. 1k ohm serie + 2k ohm a GND) en D6 -> GPIO20.\n *   3. Pre-calibrar la alimentacion a 5.00V antes de energizar Nano y DFPlayer.\n */\n\n#include <Arduino.h>\n#include <SoftwareSerial.h>\n#include <stdio.h>\n#include <string.h>\n\n// Opcional: poner en 1 para depuracion por USB Serial (desactivado por defecto\n// para evitar interferencia de interrupciones con SoftwareSerial).\n#define ENABLE_USB_DEBUG 0\n\n// --- Configuracion de Pines ---\nstatic const uint8_t PIN_TOUCH_PLAY = 2;\nstatic const uint8_t PIN_TOUCH_NEXT = 3;\nstatic const uint8_t PIN_TOUCH_PREV = 4;\nstatic const uint8_t PIN_TOUCH_MUTE = 5;\n\nstatic const uint8_t PIN_ESP_TX     = 6;  // D6 (TX Nano) -> GPIO20 (RX ESP32-C3)\nstatic const uint8_t PIN_ESP_RX     = 7;  // D7 (RX Nano) <- GPIO21 (TX ESP32-C3)\n\nstatic const uint8_t PIN_DFP_RX     = 10; // D10 (RX Nano) <- DFPlayer TX (Pin 3)\nstatic const uint8_t PIN_DFP_TX     = 11; // D11 (TX Nano) -> 1k -> DFPlayer RX (Pin 2)\nstatic const uint8_t PIN_DFP_BUSY   = 12; // D12 <- DFPlayer BUSY (Pin 16, LOW=activo)\n\n// --- Velocidades UART ---\nstatic const uint32_t DFP_BAUD  = 9600UL;\nstatic const uint32_t SYNC_BAUD = 115200UL; // Cambiar a 38400UL si hay ruido de cableado\n\nSoftwareSerial mp3Serial(PIN_DFP_RX, PIN_DFP_TX);\nSoftwareSerial espSerial(PIN_ESP_RX, PIN_ESP_TX);\n\n// --- Comandos binarios DFPlayer Mini (7E FF 06 CMD FB P1 P2 CHK_H CHK_L EF) ---\nstatic const uint8_t DFP_CMD_NEXT        = 0x01;\nstatic const uint8_t DFP_CMD_PREV        = 0x02;\nstatic const uint8_t DFP_CMD_PLAY_TRACK  = 0x03;\nstatic const uint8_t DFP_CMD_SET_VOL     = 0x06;\nstatic const uint8_t DFP_CMD_SET_EQ      = 0x07;\nstatic const uint8_t DFP_CMD_SET_SOURCE  = 0x09;\nstatic const uint8_t DFP_CMD_RESUME      = 0x0D;\nstatic const uint8_t DFP_CMD_PAUSE       = 0x0E;\nstatic const uint8_t DFP_CMD_STOP        = 0x16;\nstatic const uint8_t DFP_CMD_QUERY_FILES = 0x48;\n\nstatic const uint16_t DFP_SOURCE_SD      = 0x0002;\n\n// --- Temporizacion y antirrebote ---\nstatic const unsigned long DEBOUNCE_MS           = 50UL;\nstatic const unsigned long LONG_PRESS_MS         = 800UL;\nstatic const unsigned long BUSY_START_TIMEOUT_MS = 450UL;\nstatic const unsigned long BUSY_STOP_TIMEOUT_MS  = 150UL;\nstatic const unsigned long TRACK_END_GRACE_MS    = 600UL;\nstatic const unsigned long TRACK_END_DEBOUNCE_MS = 80UL;\nstatic const unsigned long SYNC_INTERVAL_MS      = 1000UL;\n\nstatic const uint8_t TOUCH_PINS[4] = {\n  PIN_TOUCH_PLAY,\n  PIN_TOUCH_NEXT,\n  PIN_TOUCH_PREV,\n  PIN_TOUCH_MUTE\n};\n\nstruct TouchButton {\n  uint8_t pin;\n  bool stableState;\n  bool lastReading;\n  unsigned long lastChangeMs;\n  unsigned long pressedAtMs;\n  bool longHandled;\n};\n\nenum PlayerState : uint8_t {\n  STATE_STOPPED = 0,\n  STATE_PLAYING = 1,\n  STATE_PAUSED  = 2\n};\n\nTouchButton buttons[4];\n\nPlayerState playerState      = STATE_STOPPED;\nuint16_t currentTrack        = 1;\nuint16_t totalTracks         = 0;\nuint8_t currentVol           = 20;    // Rango DFPlayer: 0..30\nbool isMuted                 = false;\n\nunsigned long trackStartMs   = 0;\nunsigned long pauseStartMs   = 0;\nunsigned long pausedAccumMs  = 0;\nunsigned long busyHighSince  = 0;\nunsigned long lastSyncSentMs = 0;\n\nchar espRxBuf[40];\nuint8_t espRxLen = 0;\n\n// --- Utilidades de depuracion ---\nstatic void debugLog(const char* msg) {\n#if ENABLE_USB_DEBUG\n  Serial.println(msg);\n#else\n  (void)msg;\n#endif\n}\n\n// --- Lectura del pin hardware BUSY (D12) ---\nstatic inline bool isDfpAudioActive() {\n  return (digitalRead(PIN_DFP_BUSY) == LOW);\n}\n\n// --- Construccion y envio de tramas binarias DFPlayer Mini ---\nstatic void sendDfpFrame(uint8_t cmd, uint16_t param, bool requestAck = false) {\n  uint8_t frame[10];\n  frame[0] = 0x7E;\n  frame[1] = 0xFF;\n  frame[2] = 0x06;\n  frame[3] = cmd;\n  frame[4] = requestAck ? 0x01 : 0x00;\n  frame[5] = static_cast<uint8_t>((param >> 8) & 0xFF);\n  frame[6] = static_cast<uint8_t>(param & 0xFF);\n\n  uint16_t sum = 0;\n  for (uint8_t i = 1; i <= 6; ++i) {\n    sum += frame[i];\n  }\n  uint16_t checksum = static_cast<uint16_t>(0U - sum);\n  frame[7] = static_cast<uint8_t>((checksum >> 8) & 0xFF);\n  frame[8] = static_cast<uint8_t>(checksum & 0xFF);\n  frame[9] = 0xEF;\n\n  mp3Serial.write(frame, sizeof(frame));\n}\n\nstatic uint16_t queryDfpTrackCount() {\n  mp3Serial.listen();\n  while (mp3Serial.available() > 0) {\n    mp3Serial.read();\n  }\n\n  sendDfpFrame(DFP_CMD_QUERY_FILES, 0x0000, false);\n\n  uint8_t rx[10];\n  uint8_t idx = 0;\n  unsigned long startMs = millis();\n\n  while ((millis() - startMs) < 400UL) {\n    if (mp3Serial.available() > 0) {\n      uint8_t b = static_cast<uint8_t>(mp3Serial.read());\n      if (idx == 0 && b != 0x7E) {\n        continue;\n      }\n      rx[idx++] = b;\n      if (idx == 10) {\n        if (rx[1] == 0xFF && rx[2] == 0x06 && rx[9] == 0xEF &&\n            (rx[3] == DFP_CMD_QUERY_FILES || rx[3] == 0x4E || rx[3] == 0x4C)) {\n          espSerial.listen();\n          return (static_cast<uint16_t>(rx[5]) << 8) | rx[6];\n        }\n        idx = 0;\n      }\n    }\n  }\n\n  espSerial.listen();\n  return 0;\n}\n\n// --- Envio de tramas de sincronizacion al ESP32-C3 ---\nstatic void sendEspCommand(const char* cmd) {\n  espSerial.print(cmd);\n  espSerial.print('\\n');\n  debugLog(cmd);\n}\n\nstatic void sendEspPlay(uint16_t track) {\n  char cmd[20];\n  snprintf(cmd, sizeof(cmd), \"PLAY:%02u\", track);\n  sendEspCommand(cmd);\n}\n\nstatic unsigned long getAudioElapsedMs() {\n  if (playerState == STATE_STOPPED) {\n    return 0UL;\n  }\n  unsigned long now = millis();\n  if (playerState == STATE_PAUSED) {\n    return (pauseStartMs - trackStartMs) - pausedAccumMs;\n  }\n  return (now - trackStartMs) - pausedAccumMs;\n}\n\nstatic void sendEspSync() {\n  char cmd[28];\n  unsigned long elapsed = getAudioElapsedMs();\n  snprintf(cmd, sizeof(cmd), \"SYNC:%02u:%lu\", currentTrack, elapsed);\n  sendEspCommand(cmd);\n  lastSyncSentMs = millis();\n}\n\n// --- Control sincronizado Audio (DFPlayer) + Video (ESP32-C3) ---\nstatic bool startTrack(uint16_t track, bool allowWrapFallback) {\n  if (track == 0) {\n    track = 1;\n  }\n\n  // Si habia audio sonando, detener primero para garantizar un flanco limpio\n  // HIGH -> LOW en BUSY (D12) al arrancar la nueva pista.\n  if (isDfpAudioActive()) {\n    sendDfpFrame(DFP_CMD_STOP, 0x0000);\n    unsigned long stopWait = millis();\n    while (isDfpAudioActive() && (millis() - stopWait) < BUSY_STOP_TIMEOUT_MS) {\n      delay(1);\n    }\n    delay(15);\n  }\n\n  // Asegurar volumen correcto antes de reproducir (respetando estado Mute)\n  sendDfpFrame(DFP_CMD_SET_VOL, isMuted ? 0 : currentVol);\n  delay(20);\n  sendDfpFrame(DFP_CMD_PLAY_TRACK, track);\n\n  // Esperar inicio fisico real del MP3 detectado por BUSY == LOW\n  bool started = false;\n  unsigned long waitStart = millis();\n  while ((millis() - waitStart) < BUSY_START_TIMEOUT_MS) {\n    if (isDfpAudioActive()) {\n      started = true;\n      break;\n    }\n    delay(1);\n  }\n\n  if (!started) {\n    if (allowWrapFallback && track > 1) {\n      // Si se desconocia totalTracks y se paso del final, volver a pista 1\n      return startTrack(1, false);\n    }\n    playerState = STATE_STOPPED;\n    sendEspCommand(\"STOP\");\n    return false;\n  }\n\n  // Instante 0 real del audio: arrancar video en ESP32-C3 inmediatamente\n  currentTrack   = track;\n  playerState    = STATE_PLAYING;\n  trackStartMs   = millis();\n  pausedAccumMs  = 0;\n  pauseStartMs   = 0;\n  busyHighSince  = 0;\n  lastSyncSentMs = trackStartMs;\n\n  sendEspPlay(currentTrack);\n  return true;\n}\n\nstatic void pausePlayback() {\n  if (playerState != STATE_PLAYING) return;\n\n  sendDfpFrame(DFP_CMD_PAUSE, 0x0000);\n  unsigned long t0 = millis();\n  while (isDfpAudioActive() && (millis() - t0) < BUSY_STOP_TIMEOUT_MS) {\n    delay(1);\n  }\n\n  pauseStartMs = millis();\n  playerState  = STATE_PAUSED;\n  sendEspCommand(\"PAUSE\");\n  sendEspSync();\n}\n\nstatic void resumePlayback() {\n  if (playerState != STATE_PAUSED) return;\n\n  sendDfpFrame(DFP_CMD_RESUME, 0x0000);\n  unsigned long t0 = millis();\n  while (!isDfpAudioActive() && (millis() - t0) < BUSY_START_TIMEOUT_MS) {\n    delay(1);\n  }\n\n  if (!isDfpAudioActive()) {\n    // Si el DFPlayer perdio el estado de pausa, relanzar la pista\n    startTrack(currentTrack, false);\n    return;\n  }\n\n  pausedAccumMs += (millis() - pauseStartMs);\n  pauseStartMs   = 0;\n  busyHighSince  = 0;\n  playerState    = STATE_PLAYING;\n\n  sendEspCommand(\"RESUME\");\n  sendEspSync();\n}\n\nstatic void stopPlayback() {\n  sendDfpFrame(DFP_CMD_STOP, 0x0000);\n  playerState   = STATE_STOPPED;\n  pausedAccumMs = 0;\n  busyHighSince = 0;\n  sendEspCommand(\"STOP\");\n}\n\nstatic void toggleMute() {\n  isMuted = !isMuted;\n  sendDfpFrame(DFP_CMD_SET_VOL, isMuted ? 0 : currentVol);\n  sendEspCommand(\"MUTE\");\n  if (playerState == STATE_PLAYING) {\n    sendEspSync();\n  }\n}\n\nstatic void nextTrack() {\n  uint16_t target = currentTrack + 1;\n  if (totalTracks > 0 && target > totalTracks) {\n    target = 1;\n  }\n  startTrack(target, true);\n}\n\nstatic void prevTrack() {\n  uint16_t target = currentTrack;\n  if (target > 1) {\n    target--;\n  } else if (totalTracks > 0) {\n    target = totalTracks;\n  } else {\n    target = 1;\n  }\n  startTrack(target, false);\n}\n\n// --- Inicializacion y lectura de botones tactiles TTP223 ---\nstatic void initButtons() {\n  for (uint8_t i = 0; i < 4; ++i) {\n    pinMode(TOUCH_PINS[i], INPUT); // Salida push-pull CMOS activa en HIGH\n    buttons[i].pin          = TOUCH_PINS[i];\n    buttons[i].stableState  = false;\n    buttons[i].lastReading  = false;\n    buttons[i].lastChangeMs = 0;\n    buttons[i].pressedAtMs  = 0;\n    buttons[i].longHandled  = false;\n  }\n}\n\nstatic void handleShortPress(uint8_t idx) {\n  switch (idx) {\n    case 0: // D2: Play / Pause\n      if (playerState == STATE_PLAYING) {\n        pausePlayback();\n      } else if (playerState == STATE_PAUSED) {\n        resumePlayback();\n      } else {\n        startTrack(currentTrack, true);\n      }\n      break;\n\n    case 1: // D3: Siguiente pista\n      nextTrack();\n      break;\n\n    case 2: // D4: Pista anterior\n      prevTrack();\n      break;\n\n    case 3: // D5 (corto): Mute / Unmute\n      toggleMute();\n      break;\n  }\n}\n\nstatic void handleLongPress(uint8_t idx) {\n  if (idx == 3) {\n    // D5 (largo >= 800 ms): Ajuste ciclico de volumen (6..30)\n    currentVol += 6;\n    if (currentVol > 30) {\n      currentVol = 6;\n    }\n    if (isMuted) {\n      isMuted = false;\n      sendEspCommand(\"MUTE\");\n    }\n    sendDfpFrame(DFP_CMD_SET_VOL, currentVol);\n  } else if (idx == 0 && playerState != STATE_STOPPED) {\n    // D2 (largo >= 800 ms): Stop completo\n    stopPlayback();\n  }\n}\n\nstatic void pollTouchSensors() {\n  unsigned long now = millis();\n\n  for (uint8_t i = 0; i < 4; ++i) {\n    bool reading = (digitalRead(buttons[i].pin) == HIGH);\n\n    if (reading != buttons[i].lastReading) {\n      buttons[i].lastChangeMs = now;\n      buttons[i].lastReading  = reading;\n    }\n\n    if ((now - buttons[i].lastChangeMs) >= DEBOUNCE_MS) {\n      if (reading != buttons[i].stableState) {\n        buttons[i].stableState = reading;\n\n        if (buttons[i].stableState) {\n          // Flanco de subida estable (inicio de toque)\n          buttons[i].pressedAtMs = now;\n          buttons[i].longHandled = false;\n        } else {\n          // Flanco de bajada estable (liberacion de toque)\n          if (!buttons[i].longHandled) {\n            handleShortPress(i);\n          }\n        }\n      } else if (buttons[i].stableState && !buttons[i].longHandled) {\n        if ((now - buttons[i].pressedAtMs) >= LONG_PRESS_MS) {\n          buttons[i].longHandled = true;\n          handleLongPress(i);\n        }\n      }\n    }\n  }\n}\n\n// --- Monitoreo de fin de pista por hardware (BUSY == HIGH) ---\nstatic void pollDfpBusyState() {\n  if (playerState != STATE_PLAYING) {\n    busyHighSince = 0;\n    return;\n  }\n\n  unsigned long now = millis();\n  if ((now - trackStartMs) < TRACK_END_GRACE_MS) {\n    return;\n  }\n\n  if (!isDfpAudioActive()) {\n    if (busyHighSince == 0) {\n      busyHighSince = now;\n    } else if ((now - busyHighSince) >= TRACK_END_DEBOUNCE_MS) {\n      // Fin real de pista confirmado\n      sendEspCommand(\"STOP\");\n      nextTrack();\n    }\n  } else {\n    busyHighSince = 0;\n  }\n}\n\n// --- Recepcion no bloqueante de ACK desde ESP32-C3 ---\nstatic void pollEspAck() {\n  while (espSerial.available() > 0) {\n    char c = static_cast<char>(espSerial.read());\n    if (c == '\\r') continue;\n    if (c == '\\n') {\n      espRxBuf[espRxLen] = '\\0';\n      if (espRxLen > 0) {\n        debugLog(espRxBuf);\n      }\n      espRxLen = 0;\n    } else if (espRxLen < (sizeof(espRxBuf) - 1)) {\n      espRxBuf[espRxLen++] = c;\n    }\n  }\n}\n\nvoid setup() {\n#if ENABLE_USB_DEBUG\n  Serial.begin(115200);\n#endif\n\n  initButtons();\n\n  // Nunca usar INPUT_PULLUP en D12: BUSY del DFPlayer es nivel 3.3V\n  pinMode(PIN_DFP_BUSY, INPUT);\n\n  mp3Serial.begin(DFP_BAUD);\n  espSerial.begin(SYNC_BAUD);\n  espSerial.listen();\n\n  // Tiempo de arranque de DFPlayer Mini y lectura de microSD\n  delay(500);\n\n  sendDfpFrame(DFP_CMD_SET_SOURCE, DFP_SOURCE_SD);\n  delay(150);\n  sendDfpFrame(DFP_CMD_SET_EQ, 0x0000); // Normal\n  delay(60);\n  sendDfpFrame(DFP_CMD_SET_VOL, currentVol);\n  delay(60);\n\n  totalTracks = queryDfpTrackCount();\n\n  // Arrancar pista 1 sincronizada al milisegundo 0 con el ESP32-C3\n  startTrack(1, false);\n}\n\nvoid loop() {\n  pollTouchSensors();\n  pollDfpBusyState();\n  pollEspAck();\n\n  if (playerState == STATE_PLAYING) {\n    unsigned long now = millis();\n    if ((now - lastSyncSentMs) >= SYNC_INTERVAL_MS) {\n      sendEspSync();\n    }\n  }\n}\n"
  },
  "esp32": {
    "title": "firmware_esclavo_esp32c3.ino",
    "path": "D:\\AntGra\\Proteus\\nuevo resultado\\firmware_esclavo_esp32c3.ino",
    "lang": "cpp",
    "meta": "C++ / ESP32-C3 RISC-V (160 MHz, SPI 20 MHz, I2C 800 kHz) · 558 líneas · Íntegro",
    "code": "/*\n * Firmware Esclavo: Decodificador de Video Streaming .BIN en OLED SSD1306\n * MCU: ESP32-C3 SuperMini (RISC-V @ 160 MHz, 3.3V)\n *\n * Arquitectura Maestro-Esclavo:\n *   - Recibe tramas de sincronizacion desde Arduino Nano V3 por HardwareSerial0:\n *     PLAY:<track>, PAUSE, RESUME, STOP, MUTE (o MUTE:0/1), SYNC:<track>:<ms>\n *   - Responde confirmacion ACK:<cmd>\\n por GPIO21 (TX).\n *   - Lee cuadros crudos de 1024 bytes (128x64 monocromo, formato pagina SSD1306)\n *     desde tarjeta MicroSD (/vid_01.bin, /vid_02.bin, ...) via SPI a 20 MHz.\n *   - Envia cada cuadro a la pantalla OLED SSD1306 (0x3C) por I2C a 800 kHz\n *     con control temporal libre de deriva acumulada (salto de cuadro si hay atraso).\n *\n * Mapa de Pines Verificado (ESP32-C3 SuperMini):\n *   - GPIO20 (UART0 RX) <- Divisor 5V->3.3V <- Arduino Nano D6 (TX)\n *   - GPIO21 (UART0 TX) -> Arduino Nano D7 (RX)\n *   - GPIO4  (SPI SCK)  -> MicroSD SCK\n *   - GPIO5  (SPI MISO) <- MicroSD MISO\n *   - GPIO6  (SPI MOSI) -> MicroSD MOSI\n *   - GPIO7  (SPI CS)   -> MicroSD CS\n *   - GPIO8  (I2C SDA)  <-> OLED SSD1306 SDA\n *   - GPIO9  (I2C SCL)  -> OLED SSD1306 SCL\n *\n * Nota sobre velocidad UART (SYNC_BAUD):\n *   - 115200 bps por defecto. Debe coincidir exactamente con SYNC_BAUD en\n *     firmware_maestro_nano.ino (cambiar ambos a 38400UL si hay ruido).\n */\n\n#include <Arduino.h>\n#include <SPI.h>\n#include <SD.h>\n#include <Wire.h>\n#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n\n// --- Pines UART0 de Sincronizacion ---\nstatic const int8_t PIN_UART_RX   = 20;\nstatic const int8_t PIN_UART_TX   = 21;\nstatic const uint32_t SYNC_BAUD   = 115200UL; // Coincidir con Maestro Nano\n\n// --- Pines MicroSD SPI (20 MHz) ---\nstatic const int8_t PIN_SD_SCK    = 4;\nstatic const int8_t PIN_SD_MISO   = 5;\nstatic const int8_t PIN_SD_MOSI   = 6;\nstatic const int8_t PIN_SD_CS     = 7;\nstatic const uint32_t SD_SPI_HZ   = 20000000UL;\n\n// --- Pines OLED SSD1306 I2C (800 kHz) ---\nstatic const int8_t PIN_OLED_SDA  = 8;\nstatic const int8_t PIN_OLED_SCL  = 9;\nstatic const uint8_t OLED_ADDR    = 0x3C;\nstatic const uint32_t OLED_I2C_HZ = 800000UL;\n\nstatic const uint16_t OLED_W      = 128;\nstatic const uint16_t OLED_H      = 64;\nstatic const size_t FRAME_BYTES   = 1024; // (128 * 64) / 8\nstatic const size_t I2C_CHUNK     = 64;   // Paquete I2C seguro dentro del buffer Wire ESP32\n\n// --- Parametros de Streaming de Video ---\nstatic const uint32_t VIDEO_FPS         = 25UL;\nstatic const uint32_t FRAME_INTERVAL_US = 1000000UL / VIDEO_FPS; // 40000 us @ 25 FPS\nstatic const int32_t SYNC_DRIFT_FRAMES  = 2; // Corregir si desfase >= 2 cuadros (~80 ms)\n\nHardwareSerial SyncSerial(0);\n\nenum VideoState : uint8_t {\n  STATE_IDLE    = 0,\n  STATE_PLAYING = 1,\n  STATE_PAUSED  = 2,\n  STATE_STOPPED = 3\n};\n\nstatic uint8_t frameBuffer[FRAME_BYTES];\n\nFile videoFile;\nbool sdReady            = false;\nbool oledReady          = false;\nbool isMuted            = false;\nVideoState videoState   = STATE_IDLE;\n\nuint16_t currentTrack   = 0;\nuint32_t totalFrames    = 0;\nuint32_t currentFrame   = 0;\nuint32_t nextFrameUs    = 0;\n\nchar rxLine[64];\nuint8_t rxLen           = 0;\n\n// ============================================================================\n// Driver directo SSD1306 I2C a 800 kHz (sin asignacion dinamica ni drift I2C)\n// ============================================================================\nstatic bool oledSendCommands(const uint8_t* cmds, size_t len) {\n  Wire.beginTransmission(OLED_ADDR);\n  Wire.write(0x00); // Byte de control: flujo de comandos\n  for (size_t i = 0; i < len; ++i) {\n    Wire.write(cmds[i]);\n  }\n  return (Wire.endTransmission() == 0);\n}\n\nstatic bool oledInit() {\n  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);\n  Wire.setClock(OLED_I2C_HZ);\n\n  static const uint8_t initSeq[] = {\n    0xAE,       // Display OFF\n    0xD5, 0x80, // Clock divide / oscillator frequency\n    0xA8, 0x3F, // Multiplex ratio 1/64\n    0xD3, 0x00, // Display offset = 0\n    0x40,       // Start line = 0\n    0x8D, 0x14, // Charge pump ON\n    0x20, 0x00, // Horizontal addressing mode\n    0xA1,       // Segment re-map (col 127 = SEG0)\n    0xC8,       // COM output scan direction remapped\n    0xDA, 0x12, // COM pins hardware config 128x64\n    0x81, 0xCF, // Contrast\n    0xD9, 0xF1, // Pre-charge period\n    0xDB, 0x40, // VCOMH deselect level\n    0xA4,       // Resume to RAM content\n    0xA6,       // Normal display\n    0x2E,       // Deactivate scroll\n    0xAF        // Display ON\n  };\n\n  if (!oledSendCommands(initSeq, sizeof(initSeq))) {\n    return false;\n  }\n  memset(frameBuffer, 0, FRAME_BYTES);\n  return true;\n}\n\nstatic void oledFlush() {\n  if (!oledReady) return;\n\n  // Asegurar ventana completa 128x64 (columnas 0..127, paginas 0..7)\n  static const uint8_t winCmds[] = {\n    0x21, 0x00, 0x7F,\n    0x22, 0x00, 0x07\n  };\n  if (!oledSendCommands(winCmds, sizeof(winCmds))) {\n    return;\n  }\n\n  for (size_t offset = 0; offset < FRAME_BYTES; offset += I2C_CHUNK) {\n    Wire.beginTransmission(OLED_ADDR);\n    Wire.write(0x40); // Byte de control: datos GDDRAM\n    Wire.write(&frameBuffer[offset], I2C_CHUNK);\n    Wire.endTransmission();\n  }\n}\n\n// ============================================================================\n// Primitivas graficas sobre frameBuffer[1024] y overlays de estado\n// ============================================================================\nstatic inline void setPixel(int16_t x, int16_t y, bool on) {\n  if (x < 0 || x >= static_cast<int16_t>(OLED_W) ||\n      y < 0 || y >= static_cast<int16_t>(OLED_H)) {\n    return;\n  }\n  uint16_t idx = (static_cast<uint16_t>(y >> 3) * OLED_W) + static_cast<uint16_t>(x);\n  uint8_t mask = static_cast<uint8_t>(1U << (y & 7));\n  if (on) {\n    frameBuffer[idx] |= mask;\n  } else {\n    frameBuffer[idx] &= static_cast<uint8_t>(~mask);\n  }\n}\n\nstatic void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, bool on) {\n  for (int16_t dy = 0; dy < h; ++dy) {\n    for (int16_t dx = 0; dx < w; ++dx) {\n      setPixel(x + dx, y + dy, on);\n    }\n  }\n}\n\nstatic void drawRect(int16_t x, int16_t y, int16_t w, int16_t h, bool on) {\n  for (int16_t dx = 0; dx < w; ++dx) {\n    setPixel(x + dx, y, on);\n    setPixel(x + dx, y + h - 1, on);\n  }\n  for (int16_t dy = 0; dy < h; ++dy) {\n    setPixel(x, y + dy, on);\n    setPixel(x + w - 1, y + dy, on);\n  }\n}\n\nstatic void getGlyph5x7(char c, uint8_t cols[5]) {\n  if (c >= 'a' && c <= 'z') {\n    c = static_cast<char>(c - 'a' + 'A');\n  }\n  switch (c) {\n    case '0': { static const uint8_t g[5] = {0x3E, 0x51, 0x49, 0x45, 0x3E}; memcpy(cols, g, 5); return; }\n    case '1': { static const uint8_t g[5] = {0x00, 0x42, 0x7F, 0x40, 0x00}; memcpy(cols, g, 5); return; }\n    case '2': { static const uint8_t g[5] = {0x42, 0x61, 0x51, 0x49, 0x46}; memcpy(cols, g, 5); return; }\n    case '3': { static const uint8_t g[5] = {0x21, 0x41, 0x45, 0x4B, 0x31}; memcpy(cols, g, 5); return; }\n    case '4': { static const uint8_t g[5] = {0x18, 0x14, 0x12, 0x7F, 0x10}; memcpy(cols, g, 5); return; }\n    case '5': { static const uint8_t g[5] = {0x27, 0x45, 0x45, 0x45, 0x39}; memcpy(cols, g, 5); return; }\n    case '6': { static const uint8_t g[5] = {0x3C, 0x4A, 0x49, 0x49, 0x30}; memcpy(cols, g, 5); return; }\n    case '7': { static const uint8_t g[5] = {0x01, 0x71, 0x09, 0x05, 0x03}; memcpy(cols, g, 5); return; }\n    case '8': { static const uint8_t g[5] = {0x36, 0x49, 0x49, 0x49, 0x36}; memcpy(cols, g, 5); return; }\n    case '9': { static const uint8_t g[5] = {0x06, 0x49, 0x49, 0x29, 0x1E}; memcpy(cols, g, 5); return; }\n    case 'A': { static const uint8_t g[5] = {0x7E, 0x11, 0x11, 0x11, 0x7E}; memcpy(cols, g, 5); return; }\n    case 'B': { static const uint8_t g[5] = {0x7F, 0x49, 0x49, 0x49, 0x36}; memcpy(cols, g, 5); return; }\n    case 'C': { static const uint8_t g[5] = {0x3E, 0x41, 0x41, 0x41, 0x22}; memcpy(cols, g, 5); return; }\n    case 'D': { static const uint8_t g[5] = {0x7F, 0x41, 0x41, 0x22, 0x1C}; memcpy(cols, g, 5); return; }\n    case 'E': { static const uint8_t g[5] = {0x7F, 0x49, 0x49, 0x49, 0x41}; memcpy(cols, g, 5); return; }\n    case 'F': { static const uint8_t g[5] = {0x7F, 0x09, 0x09, 0x09, 0x01}; memcpy(cols, g, 5); return; }\n    case 'G': { static const uint8_t g[5] = {0x3E, 0x41, 0x49, 0x49, 0x7A}; memcpy(cols, g, 5); return; }\n    case 'H': { static const uint8_t g[5] = {0x7F, 0x08, 0x08, 0x08, 0x7F}; memcpy(cols, g, 5); return; }\n    case 'I': { static const uint8_t g[5] = {0x00, 0x41, 0x7F, 0x41, 0x00}; memcpy(cols, g, 5); return; }\n    case 'L': { static const uint8_t g[5] = {0x7F, 0x40, 0x40, 0x40, 0x40}; memcpy(cols, g, 5); return; }\n    case 'M': { static const uint8_t g[5] = {0x7F, 0x02, 0x0C, 0x02, 0x7F}; memcpy(cols, g, 5); return; }\n    case 'N': { static const uint8_t g[5] = {0x7F, 0x04, 0x08, 0x10, 0x7F}; memcpy(cols, g, 5); return; }\n    case 'O': { static const uint8_t g[5] = {0x3E, 0x41, 0x41, 0x41, 0x3E}; memcpy(cols, g, 5); return; }\n    case 'P': { static const uint8_t g[5] = {0x7F, 0x09, 0x09, 0x09, 0x06}; memcpy(cols, g, 5); return; }\n    case 'R': { static const uint8_t g[5] = {0x7F, 0x09, 0x19, 0x29, 0x46}; memcpy(cols, g, 5); return; }\n    case 'S': { static const uint8_t g[5] = {0x46, 0x49, 0x49, 0x49, 0x31}; memcpy(cols, g, 5); return; }\n    case 'T': { static const uint8_t g[5] = {0x01, 0x01, 0x7F, 0x01, 0x01}; memcpy(cols, g, 5); return; }\n    case 'U': { static const uint8_t g[5] = {0x3F, 0x40, 0x40, 0x40, 0x3F}; memcpy(cols, g, 5); return; }\n    case 'V': { static const uint8_t g[5] = {0x1F, 0x20, 0x40, 0x20, 0x1F}; memcpy(cols, g, 5); return; }\n    case 'W': { static const uint8_t g[5] = {0x3F, 0x40, 0x38, 0x40, 0x3F}; memcpy(cols, g, 5); return; }\n    case 'X': { static const uint8_t g[5] = {0x63, 0x14, 0x08, 0x14, 0x63}; memcpy(cols, g, 5); return; }\n    case 'Y': { static const uint8_t g[5] = {0x07, 0x08, 0x70, 0x08, 0x07}; memcpy(cols, g, 5); return; }\n    case 'Z': { static const uint8_t g[5] = {0x61, 0x51, 0x49, 0x45, 0x43}; memcpy(cols, g, 5); return; }\n    case ':': { static const uint8_t g[5] = {0x00, 0x36, 0x36, 0x00, 0x00}; memcpy(cols, g, 5); return; }\n    case '/': { static const uint8_t g[5] = {0x20, 0x10, 0x08, 0x04, 0x02}; memcpy(cols, g, 5); return; }\n    case '.': { static const uint8_t g[5] = {0x00, 0x60, 0x60, 0x00, 0x00}; memcpy(cols, g, 5); return; }\n    case '-': { static const uint8_t g[5] = {0x08, 0x08, 0x08, 0x08, 0x08}; memcpy(cols, g, 5); return; }\n    case '_': { static const uint8_t g[5] = {0x40, 0x40, 0x40, 0x40, 0x40}; memcpy(cols, g, 5); return; }\n    default:  { memset(cols, 0, 5); return; }\n  }\n}\n\nstatic void drawText(int16_t x, int16_t y, const char* text) {\n  uint8_t cols[5];\n  int16_t cursorX = x;\n  while (*text) {\n    getGlyph5x7(*text, cols);\n    for (uint8_t col = 0; col < 5; ++col) {\n      uint8_t bits = cols[col];\n      for (uint8_t row = 0; row < 7; ++row) {\n        if (bits & (1U << row)) {\n          setPixel(cursorX + col, y + row, true);\n        }\n      }\n    }\n    cursorX += 6;\n    text++;\n  }\n}\n\n// Icono compacto de silencio (14x11) en esquina superior derecha\nstatic void drawMuteBadge() {\n  const int16_t bx = 113;\n  const int16_t by = 1;\n  fillRect(bx, by, 14, 11, false);\n  drawRect(bx, by, 14, 11, true);\n\n  // Altavoz\n  fillRect(bx + 2, by + 4, 2, 3, true);\n  setPixel(bx + 4, by + 3, true);\n  setPixel(bx + 4, by + 4, true);\n  setPixel(bx + 4, by + 5, true);\n  setPixel(bx + 4, by + 6, true);\n  setPixel(bx + 4, by + 7, true);\n  fillRect(bx + 5, by + 2, 1, 7, true);\n\n  // Cruz \"X\" de mute\n  for (int16_t i = 0; i < 5; ++i) {\n    setPixel(bx + 8 + i, by + 3 + i, true);\n    setPixel(bx + 12 - i, by + 3 + i, true);\n  }\n}\n\n// Indicador compacto de pausa (12x11) en esquina superior derecha (desplazado si hay Mute)\nstatic void drawPauseBadge() {\n  const int16_t bx = isMuted ? 99 : 115;\n  const int16_t by = 1;\n  fillRect(bx, by, 12, 11, false);\n  drawRect(bx, by, 12, 11, true);\n  fillRect(bx + 3, by + 2, 2, 7, true);\n  fillRect(bx + 7, by + 2, 2, 7, true);\n}\n\nstatic void showStatusScreen(const char* line1, const char* line2) {\n  memset(frameBuffer, 0, FRAME_BYTES);\n  drawRect(0, 0, OLED_W, OLED_H, true);\n  drawText(6, 18, line1);\n  if (line2 && line2[0] != '\\0') {\n    drawText(6, 36, line2);\n  }\n  if (isMuted) {\n    drawMuteBadge();\n  }\n  oledFlush();\n}\n\n// ============================================================================\n// Streaming de archivos .bin (128x64 = 1024 bytes por cuadro)\n// ============================================================================\nstatic void closeVideoFile() {\n  if (videoFile) {\n    videoFile.close();\n  }\n  totalFrames  = 0;\n  currentFrame = 0;\n}\n\nstatic bool openTrackVideo(uint16_t track) {\n  closeVideoFile();\n  currentTrack = track;\n\n  if (!sdReady) {\n    showStatusScreen(\"ERROR MICROSD\", \"REVISAR SPI 20M\");\n    return false;\n  }\n\n  char path[24];\n  snprintf(path, sizeof(path), \"/vid_%02u.bin\", track);\n\n  if (!SD.exists(path)) {\n    char msg[24];\n    snprintf(msg, sizeof(msg), \"PISTA %02u SIN BIN\", track);\n    showStatusScreen(\"SIN VIDEO\", msg);\n    return false;\n  }\n\n  videoFile = SD.open(path, FILE_READ);\n  if (!videoFile) {\n    showStatusScreen(\"ERROR ARCHIVO\", path);\n    return false;\n  }\n\n  uint32_t fileBytes = static_cast<uint32_t>(videoFile.size());\n  totalFrames = fileBytes / static_cast<uint32_t>(FRAME_BYTES);\n  if (totalFrames == 0) {\n    closeVideoFile();\n    showStatusScreen(\"VIDEO VACIO\", path);\n    return false;\n  }\n\n  currentFrame = 0;\n  return true;\n}\n\nstatic bool renderFrameAt(uint32_t frameIdx) {\n  if (!videoFile || frameIdx >= totalFrames) {\n    return false;\n  }\n\n  uint32_t targetOffset = frameIdx * static_cast<uint32_t>(FRAME_BYTES);\n  if (videoFile.position() != targetOffset) {\n    if (!videoFile.seek(targetOffset)) {\n      return false;\n    }\n  }\n\n  size_t readLen = videoFile.read(frameBuffer, FRAME_BYTES);\n  if (readLen != FRAME_BYTES) {\n    return false;\n  }\n\n  if (isMuted) {\n    drawMuteBadge();\n  }\n  if (videoState == STATE_PAUSED) {\n    drawPauseBadge();\n  }\n\n  oledFlush();\n  return true;\n}\n\n// ============================================================================\n// Interprete de comandos UART desde Maestro (Arduino Nano)\n// ============================================================================\nstatic void sendAck(const char* cmd) {\n  SyncSerial.print(\"ACK:\");\n  SyncSerial.println(cmd);\n}\n\nstatic void handlePlayCommand(uint16_t track) {\n  if (track == 0) track = 1;\n\n  if (!openTrackVideo(track)) {\n    videoState = STATE_STOPPED;\n    return;\n  }\n\n  videoState = STATE_PLAYING;\n  nextFrameUs = micros() + FRAME_INTERVAL_US;\n\n  if (renderFrameAt(0)) {\n    currentFrame = 1;\n  }\n}\n\nstatic void handleSyncCommand(uint16_t track, uint32_t audioMs) {\n  if (track == 0) return;\n\n  uint32_t targetFrame = static_cast<uint32_t>(\n      (static_cast<uint64_t>(audioMs) * VIDEO_FPS) / 1000ULL);\n\n  // Si estaba detenido o en otra pista (sin estar pausado), resincronizar pista\n  if (track != currentTrack && videoState != STATE_PAUSED) {\n    if (!openTrackVideo(track)) {\n      videoState = STATE_STOPPED;\n      return;\n    }\n    videoState = STATE_PLAYING;\n  }\n\n  if (videoState != STATE_PLAYING || totalFrames == 0) {\n    return;\n  }\n\n  if (targetFrame >= totalFrames) {\n    videoState = STATE_STOPPED;\n    return;\n  }\n\n  int32_t diff = static_cast<int32_t>(targetFrame) - static_cast<int32_t>(currentFrame);\n  if (diff >= SYNC_DRIFT_FRAMES || diff <= -SYNC_DRIFT_FRAMES) {\n    currentFrame = targetFrame;\n    uint32_t phaseUs = static_cast<uint32_t>(\n        (static_cast<uint64_t>(audioMs) * 1000ULL) % FRAME_INTERVAL_US);\n    nextFrameUs = micros() + (FRAME_INTERVAL_US - phaseUs);\n  }\n}\n\nstatic void processCommand(char* line) {\n  // Recortar espacios finales\n  size_t len = strlen(line);\n  while (len > 0 && (line[len - 1] == ' ' || line[len - 1] == '\\t')) {\n    line[--len] = '\\0';\n  }\n  if (len == 0) return;\n\n  if (strncmp(line, \"PLAY:\", 5) == 0) {\n    uint16_t track = static_cast<uint16_t>(atoi(line + 5));\n    handlePlayCommand(track);\n  } else if (strcmp(line, \"PAUSE\") == 0) {\n    if (videoState == STATE_PLAYING) {\n      videoState = STATE_PAUSED;\n      uint32_t shownIdx = (currentFrame > 0) ? (currentFrame - 1) : 0;\n      if (!renderFrameAt(shownIdx)) {\n        drawPauseBadge();\n        if (isMuted) drawMuteBadge();\n        oledFlush();\n      }\n    }\n  } else if (strcmp(line, \"RESUME\") == 0) {\n    if (videoState == STATE_PAUSED) {\n      videoState = STATE_PLAYING;\n      nextFrameUs = micros(); // Renderizar de inmediato el siguiente cuadro sin insignia\n    }\n  } else if (strcmp(line, \"STOP\") == 0) {\n    videoState = STATE_STOPPED;\n    closeVideoFile();\n    showStatusScreen(\"REPRODUCTOR LISTO\", \"ESPERANDO AUDIO\");\n  } else if (strcmp(line, \"MUTE\") == 0) {\n    isMuted = !isMuted;\n    if (videoState == STATE_PAUSED) {\n      uint32_t shownIdx = (currentFrame > 0) ? (currentFrame - 1) : 0;\n      renderFrameAt(shownIdx);\n    } else if (videoState == STATE_STOPPED || videoState == STATE_IDLE) {\n      showStatusScreen(\"REPRODUCTOR LISTO\", isMuted ? \"AUDIO EN MUTE\" : \"ESPERANDO AUDIO\");\n    }\n  } else if (strcmp(line, \"MUTE:1\") == 0 || strcmp(line, \"MUTE:0\") == 0) {\n    isMuted = (line[5] == '1');\n    if (videoState == STATE_PAUSED) {\n      uint32_t shownIdx = (currentFrame > 0) ? (currentFrame - 1) : 0;\n      renderFrameAt(shownIdx);\n    } else if (videoState == STATE_STOPPED || videoState == STATE_IDLE) {\n      showStatusScreen(\"REPRODUCTOR LISTO\", isMuted ? \"AUDIO EN MUTE\" : \"ESPERANDO AUDIO\");\n    }\n  } else if (strncmp(line, \"SYNC:\", 5) == 0) {\n    char* sep = strchr(line + 5, ':');\n    if (sep != nullptr) {\n      *sep = '\\0';\n      uint16_t track = static_cast<uint16_t>(atoi(line + 5));\n      uint32_t ms    = strtoul(sep + 1, nullptr, 10);\n      *sep = ':'; // Restaurar cadena original para ACK:<cmd>\n      handleSyncCommand(track, ms);\n    }\n  }\n\n  sendAck(line);\n}\n\nstatic void pollSyncUart() {\n  while (SyncSerial.available() > 0) {\n    char c = static_cast<char>(SyncSerial.read());\n    if (c == '\\r') continue;\n    if (c == '\\n') {\n      rxLine[rxLen] = '\\0';\n      if (rxLen > 0) {\n        processCommand(rxLine);\n      }\n      rxLen = 0;\n    } else if (rxLen < (sizeof(rxLine) - 1)) {\n      rxLine[rxLen++] = c;\n    } else {\n      // Desbordamiento de linea: descartar y reiniciar buffer\n      rxLen = 0;\n    }\n  }\n}\n\nstatic void stepVideoPlayback() {\n  if (videoState != STATE_PLAYING || !videoFile || totalFrames == 0) {\n    return;\n  }\n\n  uint32_t nowUs = micros();\n  int32_t lateUs = static_cast<int32_t>(nowUs - nextFrameUs);\n  if (lateUs < 0) {\n    return;\n  }\n\n  // Compensacion sin drift acumulado: si hay atraso, saltar los cuadros vencidos\n  uint32_t framesToAdvance = 1U + (static_cast<uint32_t>(lateUs) / FRAME_INTERVAL_US);\n  if (framesToAdvance > 1U) {\n    currentFrame += (framesToAdvance - 1U);\n    nextFrameUs  += (framesToAdvance - 1U) * FRAME_INTERVAL_US;\n  }\n\n  if (currentFrame >= totalFrames) {\n    videoState = STATE_STOPPED;\n    return;\n  }\n\n  renderFrameAt(currentFrame);\n  currentFrame++;\n  nextFrameUs += FRAME_INTERVAL_US;\n}\n\nvoid setup() {\n  SyncSerial.begin(SYNC_BAUD, SERIAL_8N1, PIN_UART_RX, PIN_UART_TX);\n\n  oledReady = oledInit();\n\n  SPI.begin(PIN_SD_SCK, PIN_SD_MISO, PIN_SD_MOSI, PIN_SD_CS);\n  sdReady = SD.begin(PIN_SD_CS, SPI, SD_SPI_HZ);\n\n  if (!sdReady) {\n    showStatusScreen(\"ERROR MICROSD\", \"SPI 20MHZ FALLO\");\n  } else {\n    showStatusScreen(\"ESCLAVO ESP32-C3\", \"LISTO 115200 BPS\");\n  }\n}\n\nvoid loop() {\n  pollSyncUart();\n  stepVideoPlayback();\n}\n"
  },
  "spice": {
    "title": "reproductor_multimedia_amarilis.cir",
    "path": "D:\\AntGra\\Proteus\\nuevo resultado\\reproductor_multimedia_amarilis.cir",
    "lang": "spice",
    "meta": "Netlist SPICE3 / PROSPICE · 116 líneas · Íntegro",
    "code": "* ============================================================================\n* Netlist SPICE3 / PROSPICE - Reproductor Multimedia \"Amarilis\"\n* Arquitectura Dual-MCU:\n*   - Control/Audio: Arduino Nano + DFPlayer Mini + 4x TTP223 + PAM8610 BTL\n*   - Video/OLED:    ESP32-C3 SuperMini + Modulo MicroSD SPI (20 MHz) + OLED 0.96\" I2C (800 kHz)\n*   - Potencia:      Fuente 12V 2A -> Switch -> 1000uF -> LM2596 (5.00V) + 100nF + 100uF\n*   - Interfaces:    R1=1k (Nano D11 -> DFP RX), Divisor R2=1k / (R3+R4=2k) (Nano D6 -> ESP GPIO20)\n* ============================================================================\n\n* --- 1. ALIMENTACION PRINCIPAL 12V 2A Y PROTECCION ---\n* Fuente adaptador DC 12V 2A (resistencia interna equivalente de 50 mOhm)\nV_12V N_12V_SRC 0 DC 12.0\nR_ADAP N_12V_SRC N_12V_RAW 0.05\n\n* Interruptor ON/OFF maestro (ANTES del LM2596, 1000uF y PAM8610)\nR_SW N_12V_RAW N_12V_SW 0.02\n\n* Capacitor electrolitico principal 1000uF / 25V (ESR ~ 50 mOhm)\nR_ESR_1000U N_12V_SW N_C1000_INT 0.05\nC_MAIN N_C1000_INT 0 1000u IC=12.0\n\n* --- 2. REGULACION STEP-DOWN LM2596 (5.00V) + DESACOPLE 100nF + ESTABILIZADOR 100uF ---\n* Regulador Buck LM2596 pre-calibrado a 5.00V (habilitado para Vin > 7.0V)\nE_LM2596 N_5V_REG 0 VALUE={IF(V(N_12V_SW)>7.0, 5.00, 0.0)}\n\n* Capacitor ceramico de desacople 100nF (104) a la salida del LM2596\nC_100N N_5V_REG 0 100n IC=5.0\n\n* Carga logica base en riel +5.00V_REG (Arduino Nano ~25mA + DFPlayer ~45mA + 4x TTP223 ~2mA = 72mA)\nR_LOAD_NANO_DFP N_5V_REG 0 69.4\n\n* Cable Dupont hacia modulo ESP32-C3 + MicroSD SPI (R_wire = 0.15 ohm, L_wire = 0.35 uH)\nR_WIRE_DUPONT N_5V_REG N_5V_WIRE 0.15\nL_WIRE_DUPONT N_5V_WIRE N_5V_ESP_SD 0.35u\n\n* Capacitor estabilizador 100uF junto a ESP32-C3 / MicroSD (ESR ~ 40 mOhm) + 100nF local\nR_ESR_100U N_5V_ESP_SD N_C100U_INT 0.04\nC_STAB_100U N_C100U_INT 0 100u IC=5.0\nC_DEC_ESP N_5V_ESP_SD 0 100n IC=5.0\n\n* Carga dinamica ESP32-C3 + MicroSD SPI (90 mA base + rafagas transitorias +180 mA @ SPI 20 MHz)\n* Nota: Modulo MicroSD alimentado desde +5V_ESP_SD por tener regulador AMS1117-3.3 integrado\nI_ESP_SD_BURST N_5V_ESP_SD 0 PULSE(0.090 0.270 2u 0.5u 0.5u 8u 33m)\n\n* Salida 3V3 del LDO interno del ESP32-C3 -> Alimentacion segura para OLED 0.96\" SSD1306\n* Evita que los pull-ups I2C en placa OLED lleven 5.0V hacia GPIO8/GPIO9\nE_ESP_LDO_3V3 N_3V3_ESP 0 VALUE={IF(V(N_5V_ESP_SD)>4.2, 3.30, 0.0)}\nR_OLED_LOAD N_3V3_ESP 0 165\n\n* --- 3. INTERFAZ UART NANO <-> DFPLAYER MINI (R1 = 1k ohm) ---\n* Nano D11 (5.0V) -> R1 (1k) -> DFPlayer Pin 2 RX (clamp interno a 3.3V)\nV_UART_D11 N_UART_D11 0 PULSE(0 5.0 0 10n 10n 52u 104u)\nR1_UART_DFP N_UART_D11 N_UART_RX_DFP 1k\nV_DFP_3V3 N_3V3_DFP 0 DC 3.30\nD_CLAMP_DFP N_UART_RX_DFP N_3V3_DFP D_CLAMP_ESD\n.MODEL D_CLAMP_ESD D(IS=1e-9 RS=10 N=1.20)\n\n* Retorno DFPlayer TX (Pin 3, 3.3V) -> Nano D10 y Pin BUSY (Pin 16) -> Nano D12\nV_DFP_TX N_UART_TX_DFP 0 PULSE(0 3.3 0 10n 10n 52u 104u)\nR_NANO_D10_IN N_UART_TX_DFP 0 10Meg\nV_DFP_BUSY N_DFP_BUSY 0 PULSE(3.3 0 1m 10n 10n 10m 20m)\nR_NANO_D12_IN N_DFP_BUSY 0 10Meg\n\n* --- 4. DIVISOR DE VOLTAJE 1k + 2k (R2=1k, R3+R4=2k): NANO D6 (5V) -> ESP32-C3 GPIO20 ---\n* Topologia con las 3 resistencias de 1k restantes (total 4x 1k en proyecto):\n*   N_NANO_D6 --[R2=1k]-- N_ESP_GPIO20 --[R3=1k]-- N_DIV_MID --[R4=1k]-- GND\n*   V_GPIO20 = 5.00V * (2k / 3k) = 3.333V (< 3.60V max absoluto ESP32-C3)\nV_NANO_D6 N_NANO_D6 0 PULSE(0 5.0 0 10n 10n 4.34u 8.68u)\nR2_DIV_SER N_NANO_D6 N_ESP_GPIO20 1k\nR3_DIV_BOT1 N_ESP_GPIO20 N_DIV_MID 1k\nR4_DIV_BOT2 N_DIV_MID 0 1k\nC_GPIO20_PIN N_ESP_GPIO20 0 5p\nD_CLAMP_ESP N_ESP_GPIO20 N_3V3_ESP D_CLAMP_ESD\n\n* --- 5. BUS SPI 20 MHz (MICROSD) Y BUS I2C 800 kHz (OLED SSD1306) ---\n* SPI 20 MHz: GPIO4(SCK), GPIO5(MISO), GPIO6(MOSI), GPIO7(CS)\nV_SPI_SCK N_SPI_SCK_SRC 0 PULSE(0 3.3 0 2n 2n 23n 50n)\nR_SPI_SCK N_SPI_SCK_SRC N_GPIO4_SCK 33\nC_SPI_SCK N_GPIO4_SCK 0 15p\n\n* I2C 800 kHz: GPIO8(SDA), GPIO9(SCL) con pull-ups referenciados a 3V3 del ESP32-C3\nR_I2C_PU_SDA N_3V3_ESP N_GPIO8_SDA 4.7k\nR_I2C_PU_SCL N_3V3_ESP N_GPIO9_SCL 4.7k\nC_I2C_SDA N_GPIO8_SDA 0 20p\nC_I2C_SCL N_GPIO9_SCL 0 20p\n\n* --- 6. ETAPA DE AUDIO ESTEREO (DAC_L/R -> 1uF -> POT 10k -> PAM8610 BTL -> 8 ohm) ---\n* Salidas DAC DFPlayer Mini: 1.50V DC offset + 0.50Vpp AC (0.25V pico) @ 1 kHz\nV_DAC_L N_DAC_L 0 SIN(1.5 0.25 1000)\nV_DAC_R N_DAC_R 0 SIN(1.5 0.25 1000)\n\n* Capacitores de acople AC de 1uF (bloquean 1.50V DC -> 0.00V DC en potenciometro)\nC_AC_L N_DAC_L N_POT_L_IN 1u IC=1.5\nC_AC_R N_DAC_R N_POT_R_IN 1u IC=1.5\n\n* Potenciometro estereo 10k ohm (ejemplo al 50%: 5k arriba, 5k abajo; 100%: 0 / 10k)\nR_POT_L_TOP N_POT_L_IN N_IN_L 5k\nR_POT_L_BOT N_IN_L 0 5k\nR_POT_R_TOP N_POT_R_IN N_IN_R 5k\nR_POT_R_BOT N_IN_R 0 5k\n\n* Amplificador Clase D PAM8610 BTL alimentado desde +12V_SW (Vcm = 6.00V DC)\n* Ganancia diferencial nominal 26 dB (Av=20) y maxima 32 dB (Av=40). Prohibido unir OUT- a GND.\nE_AMP_LP N_OUTLP 0 VALUE={LIMIT(0.5*V(N_12V_SW) + 10.0*V(N_IN_L), 0.2, V(N_12V_SW)-0.2)}\nE_AMP_LN N_OUTLN 0 VALUE={LIMIT(0.5*V(N_12V_SW) - 10.0*V(N_IN_L), 0.2, V(N_12V_SW)-0.2)}\nE_AMP_RP N_OUTRP 0 VALUE={LIMIT(0.5*V(N_12V_SW) + 10.0*V(N_IN_R), 0.2, V(N_12V_SW)-0.2)}\nE_AMP_RN N_OUTRN 0 VALUE={LIMIT(0.5*V(N_12V_SW) - 10.0*V(N_IN_R), 0.2, V(N_12V_SW)-0.2)}\n\n* Carga recomendada: 2x Parlantes 8 ohm BTL (P_max ~ 6.24W/ch, I_12V_total ~ 1.38A < 2.0A -> PASS)\n* Caso comparativo 4 ohm (sustituir 8 -> 4): P_max ~ 12.2W/ch, I_12V_total > 2.4A -> SOBRECARGA fuente 2A\nR_SPK_L N_OUTLP N_OUTLN 8\nR_SPK_R N_OUTRP N_OUTRN 8\n\n* --- 7. DIRECTIVA DE SIMULACION TRANSITORIA ---\n.TRAN 5u 20m\n.END\n"
  }
};

  /* ------------------------------------------------------------------------
     1. Live Monospace Clock & Sidebar / Toggles
     ------------------------------------------------------------------------ */
  const clockEl = document.getElementById("liveClock");
  function updateClock() {
    if (!clockEl) return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    clockEl.textContent = `${dateStr} · ${timeStr}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  const sidebarCollapseBtn = document.getElementById("sidebarCollapseBtn");
  if (sidebarCollapseBtn) {
    sidebarCollapseBtn.addEventListener("click", () => {
      document.body.classList.toggle("sidebar-collapsed");
    });
  }

  const toggleSignalFlow = document.getElementById("toggleSignalFlow");
  if (toggleSignalFlow) {
    toggleSignalFlow.addEventListener("click", () => {
      const pressed = toggleSignalFlow.getAttribute("aria-pressed") === "true";
      const nextState = !pressed;
      toggleSignalFlow.setAttribute("aria-pressed", String(nextState));
      document.body.classList.toggle("flow-off", !nextState);
      if (window.Amarilis3D) window.Amarilis3D.setFlowEnabled(nextState);
    });
  }

  const togglePcbTraces = document.getElementById("togglePcbTraces");
  if (togglePcbTraces) {
    togglePcbTraces.addEventListener("click", () => {
      const pressed = togglePcbTraces.getAttribute("aria-pressed") === "true";
      togglePcbTraces.setAttribute("aria-pressed", String(!pressed));
      document.body.classList.toggle("pcb-traces-off", pressed);
    });
  }

  // Active nav highlighting on scroll
  const navLinks = Array.from(document.querySelectorAll(".nav-item[data-section]"));
  const sections = navLinks
    .map((a) => document.getElementById(a.dataset.section))
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            navLinks.forEach((link) => {
              link.classList.toggle("active", link.dataset.section === entry.target.id);
            });
          }
        });
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0.05 }
    );
    sections.forEach((sec) => obs.observe(sec));
  }

  /* ------------------------------------------------------------------------
     2. Interactive Schematic Nodes + Info Card + 22 Component Photo Strip
     ------------------------------------------------------------------------ */
  const NODES = [
    {
      id: "lm2596",
      kicker: "POTENCIA 12V → +5.00V_REG",
      title: "LM2596 + 100µF + 100nF",
      status: "PASS",
      statusClass: "badge-safe",
      img: "assets/componentes/lm2596.webp",
      resumen:
        "Etapa de alimentación principal desde adaptador 12V 2A, Jack DC 2.1mm, interruptor maestro KCD1 y filtro bulk 1000µF 25V. El Step-Down LM2596 se pre-calibra a 5.00 V exactos; un capacitor local de 100 µF + 100 nF junto al ESP32-C3/MicroSD reduce el droop transitorio SPI de 256.77 mV a 14.18 mV.",
      pines: [
        ["IN+ / IN-", "+12V_SW (11.988 V) tras KCD1 y 1000µF / GND"],
        ["OUT+ / OUT-", "+5.00V_REG exacto (riple DC 0.000 mV)"],
        ["+5V_ESP_SD", "Tras Dupont 0.15 Ω + 0.35 µH: min 4.9723 V"],
        ["C_STAB_100U", "100 µF electrolítico local + 100 nF (104) cerámico"]
      ],
      electrico: [
        ["Inrush 1000µF", "2.247 A pico (establece 99% en 6.02 ms)"],
        ["Droop SPI +180mA", "14.18 mV con 100µF vs 256.77 mV sin 100µF"],
        ["Reducción Droop", "18.11× (< 15 mV objetivo PASS)"],
        ["Corriente LM2596", "157 mA nom / 347 mA pico (< 3.0 A máx)"]
      ],
      specs: [
        ["Regulador", "LM2596S Buck Step-Down (eficiencia > 85%)"],
        ["Filtro 12V", "1000 µF 25V (derating 47.6% @ 11.99 V)"],
        ["Desacople RF", "100 nF (104) 50V en salida +5.00V_REG"],
        ["Regla crítica", "Calibrar a 5.00 V con multímetro antes de conectar cargas"]
      ]
    },
    {
      id: "ttp223",
      kicker: "INTERFAZ TÁCTIL CAPACITIVA",
      title: "4× Sensores TTP223 (≤ 3 mm MDF)",
      status: "PASS (CHECK A/B)",
      statusClass: "badge-safe",
      img: "assets/componentes/ttp223.jpg",
      resumen:
        "Cuatro módulos táctiles capacitivos ocultos detrás del panel frontal de MDF fresado a ≤ 3.0 mm. Operan en modo momentáneo activo en HIGH (jumpers A y B abiertos) y se leen con antirrebote por software de 50 ms y detección de pulsación larga ≥ 800 ms.",
      pines: [
        ["TTP223 #1 → D2", "Corto: Play / Pause · Largo (≥ 800 ms): Stop"],
        ["TTP223 #2 → D3", "Siguiente pista (01 → 02 → 03 → 04)"],
        ["TTP223 #3 → D4", "Pista anterior (wrap circular)"],
        ["TTP223 #4 → D5", "Corto: Mute/Unmute · Largo: Vol+ cíclico (6..30)"]
      ],
      electrico: [
        ["Alimentación VCC", "+5.00V_REG (consumo ~0.5 mA por sensor)"],
        ["Salida SIG", "CMOS push-pull 0 V / 5.0 V (sin pull-up)"],
        ["Antirrebote FW", "DEBOUNCE_MS = 50 ms · LONG_PRESS_MS = 800 ms"],
        ["Jumpers A / B", "Ambos abiertos (activo HIGH momentáneo)"]
      ],
      specs: [
        ["Carcasa MDF", "Espesor ≤ 3.0 mm en zona capacitiva"],
        ["Frecuencia lectura", "Polling continuo en loop() del Arduino Nano"],
        ["Aislamiento", "Sin partes metálicas expuestas al usuario"],
        ["Estado SPICE", "PASS (carga lógica total < 2 mA en +5V)"]
      ]
    },
    {
      id: "nano",
      kicker: "MCU MAESTRO · 5.0V",
      title: "Arduino Nano V3 (ATmega328P)",
      status: "PASS",
      statusClass: "badge-safe",
      img: "assets/componentes/arduino_nano.webp",
      resumen:
        "Controlador maestro de 8 bits @ 16 MHz alimentado por pin +5V (VIN sin conectar). Centraliza los 4 botones TTP223, comanda al DFPlayer Mini por UART 9600 bps, detecta el inicio real del MP3 mediante el pin hardware BUSY (D12) y despacha tramas de sincronización a 115200 bps por D6 hacia el ESP32-C3.",
      pines: [
        ["D2, D3, D4, D5", "Entradas táctiles TTP223 #1..#4 (INPUT)"],
        ["D6 (TX) / D7 (RX)", "Sync ESP32-C3 @ 115200 bps (D6 vía divisor 1k+2k)"],
        ["D10 (RX) / D11 (TX)", "UART DFPlayer 9600 bps (D11 vía R1 = 1kΩ)"],
        ["D12 (INPUT)", "DFPlayer BUSY (LOW = audio activo, sin pull-up)"]
      ],
      electrico: [
        ["Alimentación", "+5.00V_REG en pin +5V (25–30 mA típico)"],
        ["Regla Pull-Up", "Prohibido INPUT_PULLUP en D7, D10 o D12 (3.3 V)"],
        ["Retorno D10 / D7", "V_OH = 3.30 V > V_IH_min (3.00 V) · margen +0.30 V"],
        ["Latencia BUSY→D12", "Flanco 2.2 ns · detección total 1.05 ms (< 1.5 ms)"]
      ],
      specs: [
        ["Arquitectura", "AVR RISC 8 bits · 32 KB Flash · 2 KB SRAM"],
        ["UART Sync", "115200 bps (SYNC cada 1000 ms durante audio)"],
        ["Tramas DFPlayer", "Binarias directas 10 B (7E FF 06 ... EF)"],
        ["Firmware", "firmware_maestro_nano.ino (537 líneas)"]
      ]
    },
    {
      id: "divider",
      kicker: "ADAPTACIÓN 5.0V → 3.333V",
      title: "Divisor Resistivo 1kΩ + 2kΩ",
      status: "PASS",
      statusClass: "badge-safe",
      img: "assets/componentes/resistencia_1k.jfif",
      resumen:
        "Red pasiva construida con tres resistencias de carbón de 1kΩ (R2 = 1kΩ en serie entre Nano D6 y ESP32-C3 GPIO20; R3 + R4 = 1kΩ + 1kΩ = 2kΩ a GND). Protege el pin RX del ESP32-C3 frente a sobrevoltaje de 5 V sin degradar la señal UART de 115200 bps.",
      pines: [
        ["Entrada", "Arduino Nano D6 (TX UART 5.00 V)"],
        ["Nodo medio", "ESP32-C3 GPIO20 (UART0 RX, máx abs. 3.60 V)"],
        ["R2 (serie)", "1 kΩ entre D6 y GPIO20"],
        ["R3 + R4 (GND)", "2× 1 kΩ en serie (2 kΩ) de GPIO20 a GND"]
      ],
      electrico: [
        ["Tensión GPIO20", "3.333 V ideal (3.306 V con R_out ATmega328P)"],
        ["Margen V_IH / V_max", "+0.858 V sobre V_IH (2.475 V) · -0.267 V bajo 3.60 V"],
        ["Corriente / Potencia", "I_div = 1.667 mA · P_total = 8.33 mW (<< 250 mW)"],
        ["Ancho de banda RC", "fc = 29.84 MHz · subida 11.0 ns (vs bit 8.68 µs)"]
      ],
      specs: [
        ["Sin divisor (FALLO)", "Fuerza 4.213 V e inyecta 31.47 mA ESD (> 10 mA daño)"],
        ["Uso total 1kΩ", "4/4 usadas (R1 UART DFP + R2, R3, R4 divisor)"],
        ["Impedancia Thevenin", "R_th = 666.67 Ω · C_pin = 8.0 pF"],
        ["Verificación SPICE", "Regla #3 PASS (0 distorsión UART 115200 bps)"]
      ]
    },
    {
      id: "esp32",
      kicker: "MCU ESCLAVO · 3.3V",
      title: "ESP32-C3 SuperMini (RISC-V)",
      status: "PASS",
      statusClass: "badge-safe",
      img: "assets/componentes/esp32_c3.jpg",
      resumen:
        "Coprocesador gráfico esclavo de 32 bits @ 160 MHz. Recibe comandos de sincronización por HardwareSerial0 (GPIO20/21), lee fotogramas de 1024 bytes desde la MicroSD por SPI a 20 MHz y los envía al OLED SSD1306 por I2C a 800 kHz con compensación sin deriva temporal.",
      pines: [
        ["GPIO20 / GPIO21", "UART0 RX (vía divisor) / TX (ACK directo a Nano D7)"],
        ["GPIO4, 5, 6, 7", "Bus SPI 20 MHz: SCK, MISO, MOSI, CS (MicroSD)"],
        ["GPIO8 / GPIO9", "Bus I2C 800 kHz: SDA / SCL hacia OLED (0x3C)"],
        ["Pin 5V / Pin 3V3", "Entrada +5V_ESP_SD · Salida 3V3 alimenta al OLED"]
      ],
      electrico: [
        ["Riel entrada +5V", "4.9865 V reposo · 4.9723 V mín con 100 µF"],
        ["Consumo dinámico", "90 mA base + ráfaga SPI +180 mA (270 mA pico)"],
        ["LDO interno 3V3", "3.30 V regula OLED y pull-ups I2C (evita 5 V)"],
        ["Tiempo por cuadro", "12.94 ms totales -> hasta 77.3 FPS máx"]
      ],
      specs: [
        ["Núcleo", "RISC-V 32-bit single-core @ 160 MHz · 4 MB Flash"],
        ["Cadencia estable", "30 FPS sostenidos (38.8% ocupación, 20.39 ms libre)"],
        ["Control deriva", "SYNC:<track>:<ms> corrige si |diff| ≥ 2 cuadros"],
        ["Firmware", "firmware_esclavo_esp32c3.ino (558 líneas)"]
      ]
    },
    {
      id: "microsd",
      kicker: "ALMACENAMIENTO VIDEO .BIN",
      title: "Módulo MicroSD SPI (20 MHz)",
      status: "PASS",
      statusClass: "badge-safe",
      img: "assets/componentes/microsd_lector.jpg",
      resumen:
        "Lector MicroSD dedicado exclusivamente al almacenamiento de archivos planos de video (/vid_01.bin..). Posee regulador LDO AMS1117-3.3 en placa (~1.05 V dropout), por lo que debe conectarse obligatoriamente a +5.00V_REG y nunca a 3.3 V.",
      pines: [
        ["VCC / GND", "+5.00V_REG (+5V_ESP_SD con 100 µF local) / GND"],
        ["SCK → GPIO4", "Reloj SPI @ 20 MHz (R_serie 33 Ω en modelo SPICE)"],
        ["MISO / MOSI", "GPIO5 (MISO) / GPIO6 (MOSI)"],
        ["CS → GPIO7", "Chip Select activo en LOW"]
      ],
      electrico: [
        ["Tensión regulada", "VCC = 5.00 V -> AMS1117 entrega 3.30 V estables"],
        ["Si VCC = 3.3 V", "Cae a ~2.25 V por dropout 1.05 V -> fallo lectura"],
        ["Tiempo bruto SPI", "0.4096 ms por 1024 B @ 20 MHz"],
        ["Lectura FAT32 total", "1.05 ms/cuadro (< 1.20 ms objetivo PASS)"]
      ],
      specs: [
        ["Tarjeta", "MicroSD #2 de 8 GB Clase 10 FAT32 (32 KB cluster)"],
        ["Formato frame", "1024 bytes por cuadro (128×64 monocromo página)"],
        ["Estabilidad", "1800+ cuadros consecutivos sin pérdida (> 1 min)"],
        ["Separación", "Independiente de MicroSD #1 de audio MP3"]
      ]
    },
    {
      id: "oled",
      kicker: "DISPLAY 128×64 · 0x3C",
      title: "OLED 0.96\" SSD1306 I2C (800 kHz)",
      status: "PASS",
      statusClass: "badge-safe",
      img: "assets/componentes/oled_ssd1306.jfif",
      resumen:
        "Pantalla gráfica monocroma de 128×64 píxeles controlada directamente por comandos I2C de página sin asignación dinámica de memoria. Se alimenta desde el pin 3V3 del ESP32-C3 porque sus resistencias pull-up I2C en placa van conectadas a VCC.",
      pines: [
        ["VCC (Pin 1)", "ESP32-C3 pin 3V3 (3.30 V — NUNCA conectar a 5 V)"],
        ["GND (Pin 2)", "GND común en estrella"],
        ["SCL (Pin 3)", "ESP32-C3 GPIO9 (reloj I2C @ 800 kHz)"],
        ["SDA (Pin 4)", "ESP32-C3 GPIO8 (datos I2C, dirección 0x3C)"]
      ],
      electrico: [
        ["Seguridad pull-ups", "VCC a 3V3 mantiene SDA/SCL en 3.30 V (< 3.60 V)"],
        ["Tiempo ráfaga I2C", "11.54 ms/cuadro (11.84 ms con comandos página)"],
        ["Flanco subida I2C", "79.6 ns con pull-ups de 4.7 kΩ"],
        ["Paquete Wire", "16 bloques de 64 bytes (I2C_CHUNK = 64)"]
      ],
      specs: [
        ["Controlador", "SSD1306 (modo direccionamiento horizontal 0x20 0x00)"],
        ["Overlays FW", "drawMuteBadge() 14×11 y drawPauseBadge() 12×11"],
        ["Orden físico real", "Verificar serigrafía: VCC | GND | SCL | SDA"],
        ["Tasa máxima", "77.3 FPS teóricos · 30 FPS estables"]
      ]
    },
    {
      id: "dfplayer",
      kicker: "DECODIFICADOR MP3 + DAC",
      title: "Módulo DFPlayer Mini (YX5200)",
      status: "PASS",
      statusClass: "badge-safe",
      img: "assets/componentes/dfplayer.webp",
      resumen:
        "Decodificador MP3 con tarjeta MicroSD #1 dedicada y salidas estéreo limpias DAC_L / DAC_R (1.50 V DC + 0.50 Vpp AC). Recibe comandos desde Nano D11 protegidos con resistencia R1 = 1 kΩ y reporta reproducción real por el pin BUSY hacia Nano D12.",
      pines: [
        ["Pin 1 (VCC) / 7,10", "+5.00V_REG / GND"],
        ["Pin 2 (RX)", "Nano D11 -> R1 (1 kΩ) -> DFPlayer RX (clamp 3.747 V)"],
        ["Pin 3 (TX)", "Directo 3.30 V -> Nano D10 (+0.30 V margen V_IH)"],
        ["Pin 16 (BUSY)", "LOW (0V) sonando / HIGH (3.3V) libre -> Nano D12"]
      ],
      electrico: [
        ["Clamp R1 = 1kΩ", "I_clamp = 1.222 mA · P(R1) = 1.494 mW peor caso"],
        ["Sync BUSY -> D12", "Subida 2.2 ns · latencia total 1.05 ms (< 1.5 ms)"],
        ["Salida DAC_L/R", "1.50 V DC offset + 0.50 Vpp AC @ 1 kHz"],
        ["Bloqueo 2× 1µF", "Reduce 1.50 V DC a -0.00063 V DC antes del pot"]
      ],
      specs: [
        ["Almacenamiento", "MicroSD #1 (8 GB FAT32, pistas MP3)"],
        ["Protocolo UART", "9600 bps, tramas 10 bytes con checksum 16-bit"],
        ["Control volumen", "Digital 0..30 (defecto 20) + Pot analógico 10 kΩ"],
        ["Nota seguridad", "No activar INPUT_PULLUP en D10 ni D12"]
      ]
    },
    {
      id: "pam8610",
      kicker: "AMPLIFICADOR CLASE D BTL",
      title: "PAM8610 (15W+15W) + 2× 8Ω",
      status: "PASS (8Ω)",
      statusClass: "badge-safe",
      img: "assets/componentes/pam8610.jpg",
      resumen:
        "Etapa de potencia estéreo Clase D Bridge-Tied Load (BTL) alimentada directamente desde +12V_SW. Dos capacitores de 1 µF y un potenciómetro estéreo de 10 kΩ eliminan el offset DC del DAC antes de ingresar al amplificador. Sus salidas BTL son flotantes (~6.00 V DC modo común).",
      pines: [
        ["+12V / GND", "Directo a +12V_SW y GND estrella (nunca por protoboard)"],
        ["IN_L / IN_R / GND", "Desde cursor del Pot 10 kΩ tras capacitores 1 µF"],
        ["OUTL+ / OUTL-", "Parlante izquierdo 8 Ω BTL flotante"],
        ["OUTR+ / OUTR-", "Parlante derecho 8 Ω BTL flotante"]
      ],
      electrico: [
        ["Modo 8 Ω (100%)", "6.244 W/ch (12.488 W tot) · I_12V = 1.392 A PASS"],
        ["Modo 4 Ω (100%)", "12.003 W/ch (24.005 W tot) · I_12V = 2.646 A WARN OCP"],
        ["Acople AC 1 µF", "fc = 17.86 Hz @ pot 50% (R_eq = 8.91 kΩ)"],
        ["Modo común BTL", "OUT+ y OUT- a 6.00 V DC respecto a GND (0.00 V dif)"]
      ],
      specs: [
        ["Eficiencia PAM8610", "η = 87% @ 8 Ω · η = 82% @ 4 Ω"],
        ["Prohibición BTL", "NUNCA unir OUTL- o OUTR- a GND"],
        ["Polaridad 1 µF", "Si son electrolíticos, polo (+) hacia DAC_L/R"],
        ["Límite si usa 4 Ω", "Limitar potenciómetro ≤ 82.8% (recomendado ≤ 70%)"]
      ]
    }
  ];

  const COMPONENT_STRIP = [
    { name: "Arduino Nano V3", tag: "MCU Maestro", img: "assets/componentes/arduino_nano.webp", node: "nano", asm: "nano" },
    { name: "ESP32-C3 SuperMini", tag: "MCU Esclavo", img: "assets/componentes/esp32_c3.jpg", node: "esp32", asm: "esp32" },
    { name: "DFPlayer Mini", tag: "Audio MP3", img: "assets/componentes/dfplayer.webp", node: "dfplayer", asm: "dfplayer" },
    { name: "OLED SSD1306", tag: "I2C 800kHz", img: "assets/componentes/oled_ssd1306.jfif", node: "oled", asm: "oled" },
    { name: "Lector MicroSD SPI", tag: "SPI 20MHz", img: "assets/componentes/microsd_lector.jpg", node: "microsd", asm: "microsd" },
    { name: "2× MicroSD 8GB", tag: "FAT32 .mp3/.bin", img: "assets/componentes/microsd_8gb.jpg", node: "microsd", asm: "microsd" },
    { name: "PAM8610 BTL", tag: "15W + 15W", img: "assets/componentes/pam8610.jpg", node: "pam8610", asm: "pam8610" },
    { name: "2× Parlantes 8Ω", tag: "1.392 A PASS", img: "assets/componentes/parlante_8ohm.jfif", node: "pam8610", asm: "speakers" },
    { name: "4× TTP223 Táctil", tag: "D2..D5 CMOS", img: "assets/componentes/ttp223.jpg", node: "ttp223", asm: "ttp223" },
    { name: "Step-Down LM2596", tag: "12V → 5.00V", img: "assets/componentes/lm2596.webp", node: "lm2596", asm: "lm2596" },
    { name: "Fuente 12V 2A", tag: "24 W Máx", img: "assets/componentes/fuente_12v_2a.webp", node: "lm2596", asm: "adapter12v" },
    { name: "Jack DC 2.1mm", tag: "Centro (+)", img: "assets/componentes/jack_dc.webp", node: "lm2596", asm: "jackdc" },
    { name: "Switch KCD1", tag: "Corte +12V_RAW", img: "assets/componentes/switch_kcd1.webp", node: "lm2596", asm: "kcd1" },
    { name: "Cap 1000µF 25V", tag: "Filtro 12V", img: "assets/componentes/cap_1000uf.jpg", node: "lm2596", asm: "cap1000" },
    { name: "Cap 100µF 16V", tag: "Estab. 14.18mV", img: "assets/componentes/cap_100uf.jpg", node: "lm2596", asm: "pb2" },
    { name: "Cap 100nF (104)", tag: "Desacople RF", img: "assets/componentes/cap_100nf.jfif", node: "lm2596", asm: "pb1" },
    { name: "2× Cap 1µF AC", tag: "Bloqueo 1.5V", img: "assets/componentes/cap_1uf.jpg", node: "pam8610", asm: "pb1" },
    { name: "Pot Estéreo 10kΩ", tag: "Volumen Maestro", img: "assets/componentes/potenciometro.jfif", node: "pam8610", asm: "pot10k" },
    { name: "4× Res 1kΩ 1/4W", tag: "R1 + Div 1k+2k", img: "assets/componentes/resistencia_1k.jfif", node: "divider", asm: "pb2" },
    { name: "2× Protoboard 170", tag: "Buses Señal", img: "assets/componentes/protoboard_170.jpg", node: "divider", asm: "pb1" },
    { name: "Cables Dupont", tag: "≤15cm / Potencia", img: "assets/componentes/cables_dupont.jpg", node: "lm2596", asm: "pb2" },
    { name: "Carcasa MDF ≤3mm", tag: "Zona Táctil", img: "assets/componentes/mdf_3mm.jpg", node: "ttp223", asm: "ttp223" }
  ];

  let activeNodeIdx = 2; // Arduino Nano default
  let activeInfoTab = "resumen";

  const infoThumb = document.getElementById("infoThumb");
  const infoKicker = document.getElementById("infoKicker");
  const infoTitle = document.getElementById("infoTitle");
  const infoStatus = document.getElementById("infoStatus");
  const infoBody = document.getElementById("infoBody");
  const nodeCounter = document.getElementById("nodeCounter");
  const infoTabBtns = Array.from(document.querySelectorAll("[data-infotab]"));

  function renderInfoCard() {
    const node = NODES[activeNodeIdx];
    if (!node) return;
    infoThumb.src = node.img;
    infoThumb.alt = node.title;
    infoKicker.textContent = node.kicker;
    infoTitle.textContent = node.title;
    infoStatus.textContent = node.status;
    infoStatus.className = `badge ${node.statusClass}`;
    nodeCounter.textContent = `${activeNodeIdx + 1} / ${NODES.length}`;

    if (activeInfoTab === "resumen") {
      infoBody.innerHTML = `<p class="info-summary-text">${node.resumen}</p>`;
    } else {
      const rows = node[activeInfoTab] || [];
      infoBody.innerHTML = `<ul class="spec-kv-list">${rows
        .map(
          ([k, v]) =>
            `<li class="spec-kv-item"><span class="spec-kv-k">${k}</span><span class="spec-kv-v">${v}</span></li>`
        )
        .join("")}</ul>`;
    }
  }

  function selectNodeById(id, syncCamera = true, asmId = null) {
    const idx = NODES.findIndex((n) => n.id === id);
    if (idx !== -1) {
      activeNodeIdx = idx;
      renderInfoCard();
      if (syncCamera && window.Amarilis3D) {
        window.Amarilis3D.focusNode(id, asmId);
      }
    }
  }

  infoTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      activeInfoTab = btn.dataset.infotab;
      infoTabBtns.forEach((b) => b.classList.toggle("active", b === btn));
      renderInfoCard();
    });
  });

  document.getElementById("prevNodeBtn")?.addEventListener("click", () => {
    activeNodeIdx = (activeNodeIdx - 1 + NODES.length) % NODES.length;
    renderInfoCard();
    if (window.Amarilis3D) window.Amarilis3D.focusNode(NODES[activeNodeIdx].id);
  });

  document.getElementById("nextNodeBtn")?.addEventListener("click", () => {
    activeNodeIdx = (activeNodeIdx + 1) % NODES.length;
    renderInfoCard();
    if (window.Amarilis3D) window.Amarilis3D.focusNode(NODES[activeNodeIdx].id);
  });

  const stripEl = document.getElementById("componentStrip");
  if (stripEl) {
    stripEl.innerHTML = COMPONENT_STRIP.map(
      (c, i) => `
      <button class="comp-chip" type="button" data-node="${c.node}" data-asm="${c.asm || ""}" data-idx="${i}">
        <img src="${c.img}" alt="${c.name}" />
        <span class="comp-chip-name">${c.name}</span>
        <span class="comp-chip-tag">${c.tag}</span>
      </button>`
    ).join("");

    stripEl.addEventListener("click", (e) => {
      const chip = e.target.closest(".comp-chip");
      if (!chip) return;
      stripEl.querySelectorAll(".comp-chip").forEach((el) => el.classList.remove("active"));
      chip.classList.add("active");
      selectNodeById(chip.dataset.node, true, chip.dataset.asm || null);
    });
  }

  renderInfoCard();

  /* ------------------------------------------------------------------------
     3. Live Interactive Amarilis Box Simulator (128x64 OLED + 4x TTP223 + UART)
     ------------------------------------------------------------------------ */
  const TRACKS = [
    { num: 1, title: "VALS AMARILIS", sub: "PISTA 01 · CULTURA", durationMs: 28000 },
    { num: 2, title: "PAUCARBAMBA", sub: "PISTA 02 · RIO HUALLAGA", durationMs: 30000 },
    { num: 3, title: "DANZA HUANUCO", sub: "PISTA 03 · NEGRITOS", durationMs: 26000 },
    { num: 4, title: "HISTORIA VIVA", sub: "PISTA 04 · AMARILIS", durationMs: 32000 }
  ];

  const sim = {
    powerOn: true,
    state: "PLAYING", // PLAYING | PAUSED | STOPPED
    trackIdx: 0,
    vol: 20,
    muted: false,
    elapsedMs: 0,
    lastTick: performance.now(),
    lastSyncLogMs: 0,
    frameCount: 0
  };

  const canvas = document.getElementById("oledCanvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const uartLogEl = document.getElementById("uartLog");
  const simTrackBadge = document.getElementById("simTrackBadge");
  const simStateBadge = document.getElementById("simStateBadge");
  const simVolBadge = document.getElementById("simVolBadge");
  const simTimeReadout = document.getElementById("simTimeReadout");

  // 1-bit pixel buffer helpers matching firmware_esclavo_esp32c3.ino
  const fb = new Uint8Array(128 * 64);

  function clearFb() {
    fb.fill(0);
  }
  function setPx(x, y, on = true) {
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || ix >= 128 || iy < 0 || iy >= 64) return;
    fb[iy * 128 + ix] = on ? 1 : 0;
  }
  function fillRectFb(x, y, w, h, on = true) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) setPx(x + dx, y + dy, on);
    }
  }
  function drawRectFb(x, y, w, h, on = true) {
    for (let dx = 0; dx < w; dx++) {
      setPx(x + dx, y, on);
      setPx(x + dx, y + h - 1, on);
    }
    for (let dy = 0; dy < h; dy++) {
      setPx(x, y + dy, on);
      setPx(x + w - 1, y + dy, on);
    }
  }

  // Exact 5x7 glyphs from firmware_esclavo_esp32c3.ino
  const GLYPHS = {
    "0": [0x3e, 0x51, 0x49, 0x45, 0x3e], "1": [0x00, 0x42, 0x7f, 0x40, 0x00],
    "2": [0x42, 0x61, 0x51, 0x49, 0x46], "3": [0x21, 0x41, 0x45, 0x4b, 0x31],
    "4": [0x18, 0x14, 0x12, 0x7f, 0x10], "5": [0x27, 0x45, 0x45, 0x45, 0x39],
    "6": [0x3c, 0x4a, 0x49, 0x49, 0x30], "7": [0x01, 0x71, 0x09, 0x05, 0x03],
    "8": [0x36, 0x49, 0x49, 0x49, 0x36], "9": [0x06, 0x49, 0x49, 0x29, 0x1e],
    "A": [0x7e, 0x11, 0x11, 0x11, 0x7e], "B": [0x7f, 0x49, 0x49, 0x49, 0x36],
    "C": [0x3e, 0x41, 0x41, 0x41, 0x22], "D": [0x7f, 0x41, 0x41, 0x22, 0x1c],
    "E": [0x7f, 0x49, 0x49, 0x49, 0x41], "F": [0x7f, 0x09, 0x09, 0x09, 0x01],
    "G": [0x3e, 0x41, 0x49, 0x49, 0x7a], "H": [0x7f, 0x08, 0x08, 0x08, 0x7f],
    "I": [0x00, 0x41, 0x7f, 0x41, 0x00], "L": [0x7f, 0x40, 0x40, 0x40, 0x40],
    "M": [0x7f, 0x02, 0x0c, 0x02, 0x7f], "N": [0x7f, 0x04, 0x08, 0x10, 0x7f],
    "O": [0x3e, 0x41, 0x41, 0x41, 0x3e], "P": [0x7f, 0x09, 0x09, 0x09, 0x06],
    "R": [0x7f, 0x09, 0x19, 0x29, 0x46], "S": [0x46, 0x49, 0x49, 0x49, 0x31],
    "T": [0x01, 0x01, 0x7f, 0x01, 0x01], "U": [0x3f, 0x40, 0x40, 0x40, 0x3f],
    "V": [0x1f, 0x20, 0x40, 0x20, 0x1f], "W": [0x3f, 0x40, 0x38, 0x40, 0x3f],
    "X": [0x63, 0x14, 0x08, 0x14, 0x63], "Y": [0x07, 0x08, 0x70, 0x08, 0x07],
    "Z": [0x61, 0x51, 0x49, 0x45, 0x43], ":": [0x00, 0x36, 0x36, 0x00, 0x00],
    "/": [0x20, 0x10, 0x08, 0x04, 0x02], ".": [0x00, 0x60, 0x60, 0x00, 0x00],
    "-": [0x08, 0x08, 0x08, 0x08, 0x08], " ": [0x00, 0x00, 0x00, 0x00, 0x00]
  };

  function drawTextFb(x, y, text) {
    let cx = x;
    for (const ch of text.toUpperCase()) {
      const cols = GLYPHS[ch] || GLYPHS[" "];
      for (let col = 0; col < 5; col++) {
        const bits = cols[col];
        for (let row = 0; row < 7; row++) {
          if (bits & (1 << row)) setPx(cx + col, y + row, true);
        }
      }
      cx += 6;
    }
  }

  // Exact Mute & Pause overlay badges from firmware_esclavo_esp32c3.ino
  function drawMuteBadgeFb() {
    const bx = 113, by = 1;
    fillRectFb(bx, by, 14, 11, false);
    drawRectFb(bx, by, 14, 11, true);
    fillRectFb(bx + 2, by + 4, 2, 3, true);
    for (let r = 3; r <= 7; r++) setPx(bx + 4, by + r, true);
    fillRectFb(bx + 5, by + 2, 1, 7, true);
    for (let i = 0; i < 5; i++) {
      setPx(bx + 8 + i, by + 3 + i, true);
      setPx(bx + 12 - i, by + 3 + i, true);
    }
  }

  function drawPauseBadgeFb() {
    const bx = sim.muted ? 99 : 115, by = 1;
    fillRectFb(bx, by, 12, 11, false);
    drawRectFb(bx, by, 12, 11, true);
    fillRectFb(bx + 3, by + 2, 2, 7, true);
    fillRectFb(bx + 7, by + 2, 2, 7, true);
  }

  function drawCulturalFrame(tSec, trackIdx) {
    clearFb();
    drawRectFb(0, 0, 128, 64, true);
    const tr = TRACKS[trackIdx];

    // Header bar
    drawTextFb(4, 3, tr.title);
    for (let x = 2; x < 126; x++) setPx(x, 12, (x % 2 === 0));

    // Cultural 1-bit scene per track
    if (trackIdx === 0) {
      // Andean mountains + rising sun rays + dancing silhouette + spectrum bars
      const sunX = 24, sunY = 26;
      for (let a = 0; a < 8; a++) {
        const ang = (a * Math.PI) / 4 + tSec * 0.8;
        for (let r = 4; r <= 9; r++) {
          setPx(sunX + Math.cos(ang) * r, sunY + Math.sin(ang) * r, true);
        }
      }
      fillRectFb(sunX - 2, sunY - 2, 5, 5, true);
      for (let x = 4; x < 74; x++) {
        const h1 = 46 - Math.max(0, 18 - Math.abs(x - 26)) * 0.7;
        const h2 = 46 - Math.max(0, 22 - Math.abs(x - 52)) * 0.75;
        const yTop = Math.min(h1, h2) | 0;
        for (let y = yTop; y <= 46; y++) setPx(x, y, true);
      }
    } else if (trackIdx === 1) {
      // Huallaga river waves + bridge arch
      for (let x = 8; x < 68; x++) {
        const arch = 24 + Math.pow((x - 38) / 14, 2) * 8;
        if (arch < 44) setPx(x, arch | 0, true);
        setPx(x, 22, true);
      }
      for (let row = 0; row < 3; row++) {
        for (let x = 6; x < 72; x++) {
          const wy = 34 + row * 4 + Math.sin(x * 0.28 + tSec * 5 + row) * 1.5;
          setPx(x, wy | 0, true);
        }
      }
    } else if (trackIdx === 2) {
      // Huanuco geometric textile diamond pulse
      const cx = 38, cy = 31;
      for (let k = 0; k < 3; k++) {
        const rad = ((k * 6 + ((tSec * 12) % 18)) | 0) % 18 + 3;
        for (let d = -rad; d <= rad; d++) {
          setPx(cx + d, cy - (rad - Math.abs(d)), true);
          setPx(cx + d, cy + (rad - Math.abs(d)), true);
        }
      }
    } else {
      // Cultural monument + pulsing radial beacon
      fillRectFb(32, 22, 12, 24, true);
      fillRectFb(28, 42, 20, 4, true);
      fillRectFb(35, 16, 6, 6, true);
      const wave = ((tSec * 16) % 16) | 0;
      drawRectFb(38 - wave, 28 - (wave >> 1), wave * 2, wave + 4, true);
    }

    // Right-side audio equalizer bars
    for (let b = 0; b < 7; b++) {
      const amp = sim.state === "PLAYING" && !sim.muted
        ? (4 + Math.abs(Math.sin(tSec * 7 + b * 1.1)) * 22) | 0
        : 2;
      fillRectFb(80 + b * 6, 46 - amp, 4, amp, true);
    }

    // Bottom progress bar + track/time
    const pct = Math.min(1, sim.elapsedMs / tr.durationMs);
    drawRectFb(4, 51, 82, 8, true);
    fillRectFb(6, 53, (pct * 78) | 0, 4, true);

    const sec = (sim.elapsedMs / 1000) | 0;
    const mm = String((sec / 60) | 0).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    drawTextFb(90, 52, `${mm}:${ss}`);
  }

  function renderOledCanvas() {
    if (!ctx) return;
    if (!sim.powerOn) {
      ctx.fillStyle = "#05070b";
      ctx.fillRect(0, 0, 128, 64);
      return;
    }
    if (sim.state === "STOPPED") {
      clearFb();
      drawRectFb(0, 0, 128, 64, true);
      drawTextFb(6, 18, "REPRODUCTOR LISTO");
      drawTextFb(6, 36, sim.muted ? "AUDIO EN MUTE" : "ESPERANDO AUDIO");
      if (sim.muted) drawMuteBadgeFb();
    } else {
      const tSec = sim.elapsedMs / 1000;
      drawCulturalFrame(tSec, sim.trackIdx);
      if (sim.muted) drawMuteBadgeFb();
      if (sim.state === "PAUSED") drawPauseBadgeFb();
    }

    const img = ctx.createImageData(128, 64);
    const d = img.data;
    for (let i = 0; i < fb.length; i++) {
      const on = fb[i] === 1;
      const p = i * 4;
      // Dual-color OLED style: top 13 rows amber/gold, rest crisp cyan-white
      const isTop = i < 128 * 13;
      if (on) {
        d[p] = isTop ? 240 : 120;
        d[p + 1] = isTop ? 185 : 238;
        d[p + 2] = isTop ? 75 : 245;
        d[p + 3] = 255;
      } else {
        d[p] = 7;
        d[p + 1] = 11;
        d[p + 2] = 18;
        d[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function appendUart(dir, msg) {
    if (!uartLogEl) return;
    const sec = (sim.elapsedMs / 1000).toFixed(2).padStart(6, "0");
    const line = document.createElement("div");
    line.className = "uart-line";
    const dirClass =
      dir === "DFP" ? "uart-dir-dfp" : dir === "ACK" ? "uart-dir-ack" : "uart-dir-tx";
    const dirLabel =
      dir === "DFP"
        ? "[D11→DFP 9600]"
        : dir === "ACK"
        ? "[G21→D7  ACK ]"
        : "[D6→G20 115k]";
    line.innerHTML = `<span class="uart-ts">${sec}s</span><span class="${dirClass}">${dirLabel}</span><span class="uart-msg">${msg}</span>`;
    uartLogEl.appendChild(line);
    while (uartLogEl.children.length > 70) {
      uartLogEl.removeChild(uartLogEl.firstChild);
    }
    uartLogEl.scrollTop = uartLogEl.scrollHeight;
    if (window.Amarilis3D) window.Amarilis3D.notifyUartActivity();
  }

  function formatDfpFrame(cmd, param) {
    const p1 = (param >> 8) & 0xff;
    const p2 = param & 0xff;
    const sum = 0xff + 0x06 + cmd + 0x00 + p1 + p2;
    const chk = (0x10000 - (sum & 0xffff)) & 0xffff;
    const bytes = [0x7e, 0xff, 0x06, cmd, 0x00, p1, p2, (chk >> 8) & 0xff, chk & 0xff, 0xef];
    return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
  }

  function syncSimBadges() {
    const tr = TRACKS[sim.trackIdx];
    simTrackBadge.textContent = `PISTA 0${tr.num} · ${tr.title}`;
    if (!sim.powerOn) {
      simStateBadge.textContent = "POWER OFF";
      simStateBadge.className = "badge badge-fail";
      simVolBadge.textContent = "0.00V (KCD1 OFF)";
      simTimeReadout.textContent = "KCD1 OFF · +12V_SW = 0.00 V";
    } else {
      simStateBadge.textContent = sim.state;
      simStateBadge.className = `badge ${
        sim.state === "PLAYING" ? "badge-safe" : sim.state === "PAUSED" ? "badge-warn" : "badge-fail"
      }`;
      simVolBadge.textContent = sim.muted ? `MUTE (${sim.vol}/30)` : `VOL ${sim.vol}/30`;

      const s = (sim.elapsedMs / 1000) | 0;
      const mm = String((s / 60) | 0).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      simTimeReadout.textContent = `t = ${mm}:${ss} · SYNC:1000ms · ${sim.muted ? "MUTE" : "AUDIO ON"}`;
    }

    if (window.Amarilis3D) {
      window.Amarilis3D.setPlaybackState({
        state: sim.state,
        muted: sim.muted,
        vol: sim.vol
      });
    }
  }

  function startTrackSim(idx) {
    if (!sim.powerOn) return;
    sim.trackIdx = ((idx % TRACKS.length) + TRACKS.length) % TRACKS.length;
    sim.state = "PLAYING";
    sim.elapsedMs = 0;
    sim.lastSyncLogMs = 0;
    const trNum = TRACKS[sim.trackIdx].num;
    const trStr = String(trNum).padStart(2, "0");
    appendUart("DFP", `${formatDfpFrame(0x03, trNum)} (PLAY_TRACK ${trStr}) · BUSY D12=LOW (1.05ms)`);
    appendUart("TX", `PLAY:${trStr}`);
    appendUart("ACK", `ACK:PLAY:${trStr}`);
    syncSimBadges();
  }

  function flashPad(btn, padIdx) {
    if (!btn) return;
    btn.classList.add("pressed");
    setTimeout(() => btn.classList.remove("pressed"), 180);
    if (typeof padIdx === "number" && window.Amarilis3D) {
      window.Amarilis3D.flashTouchPad(padIdx);
    }
  }

  const btnPadPlay = document.getElementById("btnPadPlay");
  const btnPadNext = document.getElementById("btnPadNext");
  const btnPadPrev = document.getElementById("btnPadPrev");
  const btnPadMute = document.getElementById("btnPadMute");

  btnPadPlay?.addEventListener("click", () => {
    flashPad(btnPadPlay, 0);
    if (!sim.powerOn) {
      appendUart("TX", "IGNORED: KCD1 OFF (+12V_SW = 0.00V)");
      return;
    }
    if (sim.state === "PLAYING") {
      sim.state = "PAUSED";
      appendUart("DFP", `${formatDfpFrame(0x0e, 0)} (PAUSE)`);
      appendUart("TX", "PAUSE");
      appendUart("ACK", "ACK:PAUSE");
    } else if (sim.state === "PAUSED") {
      sim.state = "PLAYING";
      appendUart("DFP", `${formatDfpFrame(0x0d, 0)} (RESUME)`);
      appendUart("TX", "RESUME");
      appendUart("ACK", "ACK:RESUME");
    } else {
      startTrackSim(sim.trackIdx);
      return;
    }
    syncSimBadges();
  });

  btnPadNext?.addEventListener("click", () => {
    flashPad(btnPadNext, 1);
    if (!sim.powerOn) return;
    startTrackSim(sim.trackIdx + 1);
  });

  btnPadPrev?.addEventListener("click", () => {
    flashPad(btnPadPrev, 2);
    if (!sim.powerOn) return;
    startTrackSim(sim.trackIdx - 1);
  });

  btnPadMute?.addEventListener("click", () => {
    flashPad(btnPadMute, 3);
    if (!sim.powerOn) return;
    sim.muted = !sim.muted;
    appendUart("DFP", `${formatDfpFrame(0x06, sim.muted ? 0 : sim.vol)} (SET_VOL ${sim.muted ? 0 : sim.vol})`);
    appendUart("TX", "MUTE");
    appendUart("ACK", "ACK:MUTE");
    syncSimBadges();
  });

  document.getElementById("btnSimStop")?.addEventListener("click", () => {
    if (!sim.powerOn) return;
    sim.state = "STOPPED";
    sim.elapsedMs = 0;
    appendUart("DFP", `${formatDfpFrame(0x16, 0)} (STOP · BUSY D12=HIGH)`);
    appendUart("TX", "STOP");
    appendUart("ACK", "ACK:STOP");
    syncSimBadges();
  });

  document.getElementById("btnSimVolUp")?.addEventListener("click", () => {
    flashPad(btnPadMute, 3);
    if (!sim.powerOn) return;
    sim.vol += 6;
    if (sim.vol > 30) sim.vol = 6;
    if (sim.muted) {
      sim.muted = false;
      appendUart("TX", "MUTE");
      appendUart("ACK", "ACK:MUTE");
    }
    appendUart("DFP", `${formatDfpFrame(0x06, sim.vol)} (SET_VOL ${sim.vol}/30)`);
    syncSimBadges();
  });

  document.getElementById("btnUartClear")?.addEventListener("click", () => {
    if (uartLogEl) uartLogEl.innerHTML = "";
  });

  document.getElementById("btnUartCollapse")?.addEventListener("click", (e) => {
    const mon = document.getElementById("uartMonitor");
    if (!mon) return;
    const isCollapsed = mon.classList.toggle("collapsed");
    e.currentTarget.textContent = isCollapsed ? "Expandir" : "Colapsar";
  });

  // Boot initial log & 30 FPS OLED loop
  appendUart("DFP", `${formatDfpFrame(0x09, 0x0002)} (SET_SOURCE SD)`);
  appendUart("DFP", `${formatDfpFrame(0x06, 20)} (SET_VOL 20)`);
  startTrackSim(0);

  function oledLoop(now) {
    const dt = now - sim.lastTick;
    sim.lastTick = now;

    if (sim.powerOn && sim.state === "PLAYING") {
      sim.elapsedMs += dt;
      const tr = TRACKS[sim.trackIdx];
      if (sim.elapsedMs - sim.lastSyncLogMs >= 1000) {
        sim.lastSyncLogMs = Math.floor(sim.elapsedMs / 1000) * 1000;
        const trStr = String(tr.num).padStart(2, "0");
        appendUart("TX", `SYNC:${trStr}:${sim.lastSyncLogMs}`);
        appendUart("ACK", `ACK:SYNC:${trStr}:${sim.lastSyncLogMs}`);
      }
      if (sim.elapsedMs >= tr.durationMs) {
        appendUart("TX", "STOP");
        startTrackSim(sim.trackIdx + 1);
      }
      syncSimBadges();
    }

    if (sim.frameCount % 2 === 0) {
      renderOledCanvas();
    }
    sim.frameCount++;
    requestAnimationFrame(oledLoop);
  }
  requestAnimationFrame(oledLoop);

  // Bidirectional bridge between 3D WebGL Workbench (scene3d.js) and Simulator/Info Card
  window.AmarilisBridge = {
    onSelectNodeFrom3D(nodeId) {
      selectNodeById(nodeId, false);
      if (stripEl) {
        stripEl.querySelectorAll(".comp-chip").forEach((el) => {
          el.classList.toggle("active", el.dataset.node === nodeId);
        });
      }
    },
    onPowerChangeFrom3D(isOn) {
      sim.powerOn = Boolean(isOn);
      if (!sim.powerOn) {
        sim.state = "STOPPED";
        appendUart("TX", "KCD1=OFF (+12V_SW = 0.00V · Sistema apagado)");
        renderOledCanvas();
        syncSimBadges();
      } else {
        appendUart("DFP", `${formatDfpFrame(0x09, 0x0002)} (POWER ON · SET_SOURCE SD)`);
        appendUart("DFP", `${formatDfpFrame(0x06, sim.vol)} (SET_VOL ${sim.vol})`);
        startTrackSim(sim.trackIdx);
        renderOledCanvas();
      }
    },
    onTouchPadFrom3D(padIdx) {
      const pads = [btnPadPlay, btnPadNext, btnPadPrev, btnPadMute];
      pads[padIdx]?.click();
    },
    onPotStepFrom3D() {
      document.getElementById("btnSimVolUp")?.click();
    },
    onFlowChangeFrom3D(enabled) {
      if (toggleSignalFlow) {
        toggleSignalFlow.setAttribute("aria-pressed", String(Boolean(enabled)));
        document.body.classList.toggle("flow-off", !enabled);
      }
    },
    openFritzingLightbox() {
      currentGalleryFilter = "all";
      filterBtns.forEach((b) => b.classList.toggle("active", b.dataset.filter === "all"));
      renderGallery();
      openLightboxAt(3);
    }
  };

  /* ------------------------------------------------------------------------
     4. 3 Interactive Electrical Fault / Safety Toggles (simulacion_resultados.json)
     ------------------------------------------------------------------------ */
  const faultCardSpk = document.getElementById("faultCardSpk");
  const btnSpk8 = document.getElementById("btnSpk8");
  const btnSpk4 = document.getElementById("btnSpk4");

  function setSpeakerMode(is8Ohm) {
    faultCardSpk.className = `paper-card fault-card ${is8Ohm ? "state-safe" : "state-warn"}`;
    btnSpk8.className = `seg-btn ${is8Ohm ? "active-safe" : ""}`;
    btnSpk4.className = `seg-btn ${!is8Ohm ? "active-warn" : ""}`;
    const badge = document.getElementById("spkBadge");
    badge.className = `badge ${is8Ohm ? "badge-safe" : "badge-warn"}`;
    badge.textContent = is8Ohm ? "PASS SEGURO" : "WARNING OCP > 2.00 A";

    document.getElementById("spkPowerVal").textContent = is8Ohm ? "6.244 W/ch" : "12.003 W/ch";
    document.getElementById("spkCurrVal").textContent = is8Ohm ? "1.392 A" : "2.646 A";
    document.getElementById("spkTotalVal").textContent = is8Ohm ? "12.488 W" : "24.005 W";
    document.getElementById("spkLimitVal").textContent = is8Ohm ? "69.6% (≤ 2.00 A)" : "132.3% (SOBRECARGA)";
    const meter = document.getElementById("spkMeter");
    meter.style.width = is8Ohm ? "52%" : "100%";
    meter.style.background = is8Ohm ? "var(--safe)" : "var(--amber)";
    document.getElementById("spkNote").textContent = is8Ohm
      ? "Con 8 Ω al 100% de volumen, la corriente en 12 V alcanza 1.392 A (margen seguro bajo 2.00 A, η=87%)."
      : "Con 4 Ω al 100%, el PAM8610 exige 2.646 A (> 2.00 A OCP), causando caída de tensión y reinicios. Limitar pot ≤ 82.8%.";
  }
  btnSpk8?.addEventListener("click", () => setSpeakerMode(true));
  btnSpk4?.addEventListener("click", () => setSpeakerMode(false));

  const faultCardCap = document.getElementById("faultCardCap");
  const btnCapWith = document.getElementById("btnCapWith");
  const btnCapWithout = document.getElementById("btnCapWithout");

  function setCapMode(withCap) {
    faultCardCap.className = `paper-card fault-card ${withCap ? "state-safe" : "state-fail"}`;
    btnCapWith.className = `seg-btn ${withCap ? "active-safe" : ""}`;
    btnCapWithout.className = `seg-btn ${!withCap ? "active-fail" : ""}`;
    const badge = document.getElementById("capBadge");
    badge.className = `badge ${withCap ? "badge-safe" : "badge-fail"}`;
    badge.textContent = withCap ? "PASS (< 15 mV)" : "FAIL BROWNOUT";

    document.getElementById("capDroopVal").textContent = withCap ? "14.18 mV" : "256.77 mV";
    document.getElementById("capMinVal").textContent = withCap ? "4.9723 V" : "4.7297 V";
    document.getElementById("capDrop5Val").textContent = withCap ? "27.68 mV" : "270.27 mV";
    document.getElementById("capFactorVal").textContent = withCap ? "18.11×" : "1.00× (sin filtro)";
    const meter = document.getElementById("capMeter");
    meter.style.width = withCap ? "8%" : "96%";
    meter.style.background = withCap ? "var(--safe)" : "var(--high)";
    document.getElementById("capNote").textContent = withCap
      ? "El capacitor electrolítico de 100 µF junto al ESP32-C3/MicroSD amortigua la inductancia Dupont (0.35 µH) y evita reinicios por brownout."
      : "Sin 100 µF local, la ráfaga SPI de 180 mA cae a 4.7297 V (droop 256.77 mV + overshoot 222.04 mV), provocando brownout en ESP32-C3/SD.";
  }
  btnCapWith?.addEventListener("click", () => setCapMode(true));
  btnCapWithout?.addEventListener("click", () => setCapMode(false));

  const faultCardDiv = document.getElementById("faultCardDiv");
  const btnDivWith = document.getElementById("btnDivWith");
  const btnDivWithout = document.getElementById("btnDivWithout");

  function setDivMode(withDiv) {
    faultCardDiv.className = `paper-card fault-card ${withDiv ? "state-safe" : "state-fail"}`;
    btnDivWith.className = `seg-btn ${withDiv ? "active-safe" : ""}`;
    btnDivWithout.className = `seg-btn ${!withDiv ? "active-fail" : ""}`;
    const badge = document.getElementById("divBadge");
    badge.className = `badge ${withDiv ? "badge-safe" : "badge-fail"}`;
    badge.textContent = withDiv ? "PASS (3.333 V)" : "DAÑO PERMANENTE";

    document.getElementById("divVoltVal").textContent = withDiv ? "3.333 V" : "4.213 V (FORZADO)";
    document.getElementById("divCurrVal").textContent = withDiv ? "1.67 mA" : "31.47 mA ESD";
    document.getElementById("divBwVal").textContent = withDiv ? "29.84 MHz" : "CORTO ESD";
    document.getElementById("divLimVal").textContent = withDiv ? "≤ 3.60 V / 10 mA" : "> 3.15× LÍMITE ESD";
    const meter = document.getElementById("divMeter");
    meter.style.width = withDiv ? "17%" : "100%";
    meter.style.background = withDiv ? "var(--safe)" : "var(--high)";
    document.getElementById("divNote").textContent = withDiv
      ? "R2=1kΩ en serie y R3+R4=2kΩ a GND mantienen GPIO20 en 3.333 V (3.306 V real con R_out AVR), con margen +0.858 V sobre V_IH y subida de 11.0 ns."
      : "Conectar D6 (5.0 V) directo a GPIO20 fuerza el pin a 4.213 V e inyecta 31.47 mA por el diodo ESD interno (> 10.0 mA límite -> daño irreversible).";
  }
  btnDivWith?.addEventListener("click", () => setDivMode(true));
  btnDivWithout?.addEventListener("click", () => setDivMode(false));

  /* ------------------------------------------------------------------------
     5. Flowchart Zoom Controls + Syntax-Highlighted Full Code Viewer
     ------------------------------------------------------------------------ */
  let flowZoom = 100;
  const flowchartImg = document.getElementById("flowchartImg");
  function applyFlowZoom() {
    if (flowchartImg) flowchartImg.style.width = `${flowZoom}%`;
  }
  document.getElementById("flowZoomIn")?.addEventListener("click", () => {
    flowZoom = Math.min(220, flowZoom + 25);
    applyFlowZoom();
  });
  document.getElementById("flowZoomOut")?.addEventListener("click", () => {
    flowZoom = Math.max(60, flowZoom - 25);
    applyFlowZoom();
  });
  document.getElementById("flowZoomReset")?.addEventListener("click", () => {
    flowZoom = 100;
    applyFlowZoom();
  });

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function highlightLine(raw, lang) {
    let html = escapeHtml(raw);
    if (lang === "spice") {
      if (/^\s*\*/.test(raw)) return `<span class="tok-cm">${html}</span>`;
      if (/^\s*\./.test(raw)) {
        return html.replace(/^(\s*\.[A-Za-z0-9_]+)/, '<span class="tok-kw">$1</span>');
      }
      html = html.replace(
        /\b(VALUE|PULSE|SIN|LIMIT|IF|DC)\b/g,
        '<span class="tok-fn">$1</span>'
      );
      html = html.replace(
        /^([A-Za-z0-9_]+)/,
        '<span class="tok-kw">$1</span>'
      );
      return html;
    }

    const tokenRe =
      /(\/\*[\s\S]*?\*\/|\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#\s*[a-zA-Z_]+|\b(?:static|const|void|bool|char|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|uint64_t|size_t|unsigned|long|enum|struct|inline|if|else|for|while|switch|case|default|break|continue|return|true|false|nullptr|static_cast)\b|\b(?:Arduino|SoftwareSerial|HardwareSerial|File|SD|SPI|Wire|Serial|SyncSerial|mp3Serial|espSerial|digitalRead|pinMode|millis|micros|delay|snprintf|memset|memcpy|strcmp|strncmp|strlen|strchr|atoi|strtoul|HIGH|LOW|INPUT|FILE_READ|SERIAL_8N1)\b)/gm;

    return html.replace(tokenRe, (m) => {
      if (m.startsWith("//") || m.startsWith("/*")) return `<span class="tok-cm">${m}</span>`;
      if (m.startsWith('"') || m.startsWith("'")) return `<span class="tok-str">${m}</span>`;
      if (m.startsWith("#")) return `<span class="tok-fn">${m}</span>`;
      if (/^(Arduino|SoftwareSerial|HardwareSerial|File|SD|SPI|Wire|Serial|SyncSerial|mp3Serial|espSerial|digitalRead|pinMode|millis|micros|delay|snprintf|memset|memcpy|strcmp|strncmp|strlen|strchr|atoi|strtoul|HIGH|LOW|INPUT|FILE_READ|SERIAL_8N1)$/.test(m)) {
        return `<span class="tok-fn">${m}</span>`;
      }
      return `<span class="tok-kw">${m}</span>`;
    });
  }

  let currentCodeKey = "nano";
  const codeTable = document.getElementById("codeTable");
  const codeMetaFile = document.getElementById("codeMetaFile");
  const codeMetaStats = document.getElementById("codeMetaStats");
  const codeTabs = Array.from(document.querySelectorAll("[data-codekey]"));

  function renderCodeViewer(key) {
    currentCodeKey = key;
    const entry = SOURCE_FILES[key];
    if (!entry || !codeTable) return;
    codeMetaFile.textContent = entry.path;
    codeMetaStats.textContent = entry.meta;
    codeTabs.forEach((b) => b.classList.toggle("active", b.dataset.codekey === key));

    const lines = entry.code.replace(/\r\n/g, "\n").split("\n");
    let inBlockComment = false;
    const rowsHtml = lines
      .map((line, i) => {
        let rendered;
        if (entry.lang === "cpp") {
          const trimmed = line.trim();
          if (inBlockComment) {
            rendered = `<span class="tok-cm">${escapeHtml(line)}</span>`;
            if (trimmed.includes("*/")) inBlockComment = false;
          } else if (trimmed.startsWith("/*") && !trimmed.includes("*/")) {
            inBlockComment = true;
            rendered = `<span class="tok-cm">${escapeHtml(line)}</span>`;
          } else {
            rendered = highlightLine(line, entry.lang);
          }
        } else {
          rendered = highlightLine(line, entry.lang);
        }
        return `<tr><td class="code-ln">${i + 1}</td><td class="code-src">${rendered || " "}</td></tr>`;
      })
      .join("");

    codeTable.innerHTML = rowsHtml;
  }

  codeTabs.forEach((btn) => {
    btn.addEventListener("click", () => renderCodeViewer(btn.dataset.codekey));
  });

  document.getElementById("btnExpandCode")?.addEventListener("click", (e) => {
    const card = document.getElementById("codeViewerCard");
    if (!card) return;
    const expanded = card.classList.toggle("expanded");
    e.currentTarget.textContent = expanded ? "Contraer" : "Expandir";
  });

  document.getElementById("btnCopyCode")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const text = SOURCE_FILES[currentCodeKey]?.code || "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    const prev = btn.textContent;
    btn.textContent = "Copiado ✓";
    setTimeout(() => {
      btn.textContent = prev;
    }, 1800);
  });

  renderCodeViewer("nano");

  /* ------------------------------------------------------------------------
     6. Proteus Simulation & Wiring Gallery (9 Assets) + Lightbox Modal
     ------------------------------------------------------------------------ */
  const GALLERY_ITEMS = [
    {
      cat: "proteus",
      catLabel: "Proteus",
      title: "Esquemático Principal Proteus 8.13",
      desc: "Captura completa en Proteus ISIS: etapas 12V→5V, Arduino Nano, divisor 1kΩ+2kΩ, ESP32-C3, DFPlayer Mini y PAM8610 BTL.",
      src: "assets/1_esquematico_proteus_simulacion.png"
    },
    {
      cat: "proteus",
      catLabel: "Proteus",
      title: "Mapa de Conexión Rápida Proteus",
      desc: "Guía de etiquetas de red (+12V_SW, +5.00V_REG, +3V3_ESP_OLED, BUSY, DAC_L/R) para cableado y simulación rápida.",
      src: "assets/2_mapa_conexion_rapida_proteus.png"
    },
    {
      cat: "proteus",
      catLabel: "Proteus",
      title: "Cuadro Comparativo: Real vs Proteus",
      desc: "Equivalencia componente por componente entre los módulos físicos del prototipo y sus modelos SPICE/Proteus.",
      src: "assets/1_cuadro_comparativo_real_vs_proteus.png"
    },
    {
      cat: "fisica",
      catLabel: "Conexión Física",
      title: "Mapa de Conexión Real (Fritzing)",
      desc: "Distribución sobre dos miniprotoboards de 170 puntos, buses de señal cortos y ruteo de potencia separado.",
      src: "assets/2_mapa_conexion_real_fritzing.png"
    },
    {
      cat: "fisica",
      catLabel: "Conexión Física",
      title: "Mapa de Conexión con Fotos Reales",
      desc: "Diagrama fotográfico de montaje con módulos físicos reales, polaridad de capacitores y pinout OLED VCC|GND|SCL|SDA.",
      src: "assets/3_mapa_conexion_fotos_reales.png"
    },
    {
      cat: "spice",
      catLabel: "Diagramas SPICE",
      title: "Figura 1 — Arquitectura Dual-MCU",
      desc: "Diagrama en bloques maestro-esclavo AVR 5V + RISC-V 3.3V con aislamiento de rieles y etapa BTL.",
      src: "assets/fig1_arquitectura_dual_mcu.svg"
    },
    {
      cat: "spice",
      catLabel: "Diagramas SPICE",
      title: "Figura 4 — Diagrama de Flujo Dual-MCU",
      desc: "Secuencia sincronizada desde el flanco BUSY→D12 (< 1.5 ms) hasta el loop de 30 FPS sin deriva.",
      src: "assets/fig4_diagrama_flujo_dual_mcu.svg"
    },
    {
      cat: "spice",
      catLabel: "Diagramas SPICE",
      title: "Figura 5 — Métricas SPICE y Rendimiento",
      desc: "Comparativa 8 Ω vs 4 Ω, caída transitoria 5V (14.18 mV vs 256.77 mV) y ocupación del bus SPI+I2C.",
      src: "assets/fig5_metricas_spice_rendimiento.svg"
    },
    {
      cat: "spice",
      catLabel: "Diagramas SPICE",
      title: "Figura 6 — Pinout y Buses de Arquitectura",
      desc: "Asignación verificada de pines en Arduino Nano (D2..D12), ESP32-C3 (GPIO4..9, 20, 21) y DFPlayer Mini.",
      src: "assets/fig6_pinout_buses_arquitectura.svg"
    }
  ];

  const galleryGrid = document.getElementById("galleryGrid");
  const filterBtns = Array.from(document.querySelectorAll("#galleryFilters .filter-btn"));
  let currentGalleryFilter = "all";
  let currentFilteredItems = GALLERY_ITEMS.slice();
  let lightboxIdx = 0;
  let lightboxZoom = 1;

  function renderGallery() {
    currentFilteredItems =
      currentGalleryFilter === "all"
        ? GALLERY_ITEMS
        : GALLERY_ITEMS.filter((it) => it.cat === currentGalleryFilter);

    if (!galleryGrid) return;
    galleryGrid.innerHTML = currentFilteredItems
      .map(
        (item, idx) => `
      <article class="paper-card gallery-item" data-gidx="${idx}" tabindex="0" role="button" aria-label="Abrir ${item.title}">
        <div class="gallery-thumb-box">
          <img src="${item.src}" alt="${item.title}" />
        </div>
        <div class="gallery-caption">
          <span class="badge badge-teal" style="margin-bottom:5px;">${item.catLabel}</span>
          <h4>${item.title}</h4>
          <p>${item.desc}</p>
        </div>
      </article>`
      )
      .join("");
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentGalleryFilter = btn.dataset.filter;
      filterBtns.forEach((b) => b.classList.toggle("active", b === btn));
      renderGallery();
    });
  });

  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxTitle = document.getElementById("lightboxTitle");
  const lightboxDesc = document.getElementById("lightboxDesc");

  function updateLightboxView() {
    const item = currentFilteredItems[lightboxIdx];
    if (!item || !lightbox) return;
    lightboxImg.src = item.src;
    lightboxImg.alt = item.title;
    lightboxTitle.textContent = `${item.title} (${lightboxIdx + 1}/${currentFilteredItems.length})`;
    lightboxDesc.textContent = item.desc;
    lightboxImg.style.transform = `scale(${lightboxZoom})`;
  }

  function openLightboxAt(idx) {
    lightboxIdx = ((idx % currentFilteredItems.length) + currentFilteredItems.length) % currentFilteredItems.length;
    lightboxZoom = 1;
    updateLightboxView();
    lightbox?.classList.add("open");
  }

  function closeLightbox() {
    lightbox?.classList.remove("open");
  }

  galleryGrid?.addEventListener("click", (e) => {
    const card = e.target.closest(".gallery-item");
    if (card) openLightboxAt(Number(card.dataset.gidx));
  });

  galleryGrid?.addEventListener("keydown", (e) => {
    const card = e.target.closest(".gallery-item");
    if (card && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openLightboxAt(Number(card.dataset.gidx));
    }
  });

  document.getElementById("flowOpenModal")?.addEventListener("click", () => {
    currentGalleryFilter = "all";
    filterBtns.forEach((b) => b.classList.toggle("active", b.dataset.filter === "all"));
    renderGallery();
    openLightboxAt(6);
  });

  document.getElementById("chartPreviewBtn")?.addEventListener("click", () => {
    currentGalleryFilter = "all";
    filterBtns.forEach((b) => b.classList.toggle("active", b.dataset.filter === "all"));
    renderGallery();
    openLightboxAt(7);
  });

  document.getElementById("lbClose")?.addEventListener("click", closeLightbox);
  document.getElementById("lbPrev")?.addEventListener("click", () => openLightboxAt(lightboxIdx - 1));
  document.getElementById("lbNext")?.addEventListener("click", () => openLightboxAt(lightboxIdx + 1));
  document.getElementById("lbZoomIn")?.addEventListener("click", () => {
    lightboxZoom = Math.min(2.6, +(lightboxZoom + 0.3).toFixed(2));
    lightboxImg.style.transform = `scale(${lightboxZoom})`;
  });
  document.getElementById("lbZoomOut")?.addEventListener("click", () => {
    lightboxZoom = Math.max(0.6, +(lightboxZoom - 0.3).toFixed(2));
    lightboxImg.style.transform = `scale(${lightboxZoom})`;
  });
  document.getElementById("lbZoomReset")?.addEventListener("click", () => {
    lightboxZoom = 1;
    lightboxImg.style.transform = "scale(1)";
  });

  lightbox?.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if (!lightbox?.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") openLightboxAt(lightboxIdx - 1);
    if (e.key === "ArrowRight") openLightboxAt(lightboxIdx + 1);
    if (e.key === "+" || e.key === "=") {
      lightboxZoom = Math.min(2.6, +(lightboxZoom + 0.3).toFixed(2));
      lightboxImg.style.transform = `scale(${lightboxZoom})`;
    }
    if (e.key === "-") {
      lightboxZoom = Math.max(0.6, +(lightboxZoom - 0.3).toFixed(2));
      lightboxImg.style.transform = `scale(${lightboxZoom})`;
    }
  });

  renderGallery();

  /* ------------------------------------------------------------------------
     7. 6 SPICE PASS Rules & Searchable 23-Item BOM Table (S/ 235.50)
     ------------------------------------------------------------------------ */
  const SAFETY_RULES = [
    {
      id: "REGLA 01",
      title: "Etapa 12V con Fuente 2A y Carga 8Ω",
      evidence:
        "Con parlantes 8 Ω al 100% (32 dB): P_max = 6.244 W/ch (12.488 W total), I_12V = 1.392 A (< 2.00 A PASS seguro). Con 4 Ω: 12.003 W/ch y 2.646 A (> 2.00 A WARNING OCP)."
    },
    {
      id: "REGLA 02",
      title: "Estabilizador 100µF + 100nF en +5.00V",
      evidence:
        "Ante ráfaga SPI 20 MHz (+180 mA, pico 270 mA) sobre Dupont 0.15 Ω: sin 100 µF cae 256.77 mV (4.7297 V brownout). Con 100 µF cae 14.18 mV (4.9723 V, mejora 18.11×)."
    },
    {
      id: "REGLA 03",
      title: "Divisor 1kΩ + 2kΩ (Nano D6 → GPIO20)",
      evidence:
        "V_GPIO20 = 3.333 V (margen 2.475–3.60 V), I_div = 1.667 mA, P_total = 8.33 mW, fc = 29.84 MHz. Sin divisor inyecta 31.47 mA ESD (> 10 mA daño permanente)."
    },
    {
      id: "REGLA 04",
      title: "UART D11→R1→DFPlayer RX & BUSY→D12",
      evidence:
        "R1 = 1 kΩ limita I_clamp = 1.222 mA (P = 1.49 mW). Retorno TX 3.30 V > V_IH (3.00 V). Flanco BUSY→D12 en 2.2 ns con latencia total 1.05 ms (< 1.5 ms)."
    },
    {
      id: "REGLA 05",
      title: "Video 128×64 @ 30 FPS y Rieles OLED/SD",
      evidence:
        "Lectura MicroSD SPI 20 MHz = 1.05 ms + OLED I2C 800 kHz = 11.54 ms (12.94 ms/cuadro -> 77.3 FPS máx). OLED a 3V3 evita 5 V en I2C; MicroSD a +5V evita caída a 2.25 V."
    },
    {
      id: "REGLA 06",
      title: "Acople AC 2× 1µF & BTL PAM8610 Flotante",
      evidence:
        "Bloquea 1.50 V DC del DAC a -0.00063 V DC (fc = 17.86 Hz @ pot 50%). Salidas OUT+/- operan a Vcm = 6.00 V DC y 0.00 V diferencial DC (prohibido a GND)."
    }
  ];

  const rulesGrid = document.getElementById("rulesGrid");
  if (rulesGrid) {
    rulesGrid.innerHTML = SAFETY_RULES.map(
      (r) => `
      <article class="paper-card rule-card">
        <div class="rule-head">
          <span class="rule-id">${r.id}</span>
          <span class="badge badge-safe">PASS</span>
        </div>
        <h4>${r.title}</h4>
        <p>${r.evidence}</p>
      </article>`
    ).join("");
  }

  const BOM_ITEMS = [
    { idx: 1, cat: "base", catLabel: "Base", name: "Fuente Adaptador AC/DC 12 V 2 A", spec: "Entrada DC regulada (24 W máx., centro positivo)", qty: "1", unit: 18.0, sub: 18.0 },
    { idx: 2, cat: "base", catLabel: "Base", name: "Conector Jack DC Hembra 2.1 mm", spec: "Acoplamiento mecánico 5.5 × 2.1 mm", qty: "1", unit: 2.5, sub: 2.5 },
    { idx: 3, cat: "base", catLabel: "Base", name: "Interruptor Basculante ON/OFF (KCD1)", spec: "Corte maestro del riel +12V_RAW", qty: "1", unit: 3.0, sub: 3.0 },
    { idx: 4, cat: "base", catLabel: "Base", name: "Capacitor Electrolítico 1000 µF / 25 V", spec: "Filtro bulk anti-transitorios en +12V_SW", qty: "1", unit: 2.0, sub: 2.0 },
    { idx: 5, cat: "base", catLabel: "Base", name: "Regulador Step-Down LM2596", spec: "Conversión 12 V → +5.00 V_REG (pre-calibrar)", qty: "1", unit: 9.0, sub: 9.0 },
    { idx: 6, cat: "base", catLabel: "Base", name: "Capacitor Cerámico 100 nF (104) / 50 V", spec: "Desacople RF de salida LM2596", qty: "1", unit: 0.5, sub: 0.5 },
    { idx: 7, cat: "base", catLabel: "Base", name: "Capacitor Electrolítico 100 µF / 16 V", spec: "Estabilizador local +5V junto a ESP32-C3/SD (14.18 mV)", qty: "1", unit: 1.0, sub: 1.0 },
    { idx: 8, cat: "base", catLabel: "Base", name: "Arduino Nano V3 (ATmega328P @ 16 MHz)", spec: "Controlador maestro AVR 5V (D2..D7, D10..D12)", qty: "1", unit: 24.0, sub: 24.0 },
    { idx: 9, cat: "base", catLabel: "Base", name: "Módulo DFPlayer Mini (MP3-TF-16P)", spec: "Decodificador MP3 hardware + DAC estéreo + BUSY", qty: "1", unit: 14.0, sub: 14.0 },
    { idx: 10, cat: "base", catLabel: "Base", name: "Tarjeta MicroSD #1 (8 GB FAT32)", spec: "Almacenamiento independiente de audio (/mp3)", qty: "1", unit: 12.0, sub: 12.0 },
    { idx: 11, cat: "base", catLabel: "Base", name: "Sensores Capacitivos TTP223", spec: "Botonera oculta Play/Pause, Sig, Ant, Mute (MDF ≤ 3 mm)", qty: "4", unit: 3.0, sub: 12.0 },
    { idx: 12, cat: "base", catLabel: "Base", name: "Resistencias de Carbón 1 kΩ (1/4 W)", spec: "R1 UART D11→DFP RX + R2/R3/R4 divisor 1k+2k (D6→GPIO20)", qty: "4", unit: 0.25, sub: 1.0 },
    { idx: 13, cat: "base", catLabel: "Base", name: "Capacitores de Acople AC 1 µF", spec: "Bloqueo DC (1.50 V → 0.00 V) en DAC_L/R", qty: "2", unit: 1.0, sub: 2.0 },
    { idx: 14, cat: "base", catLabel: "Base", name: "Potenciómetro Estéreo 10 kΩ + Perilla", spec: "Atenuador maestro analógico de volumen (fc 17.86 Hz)", qty: "1", unit: 5.5, sub: 5.5 },
    { idx: 15, cat: "base", catLabel: "Base", name: "Amplificador Clase D PAM8610 (15W+15W)", spec: "Etapa de potencia estéreo BTL flotante (Vcm 6.00 V)", qty: "1", unit: 15.0, sub: 15.0 },
    { idx: 16, cat: "base", catLabel: "Base", name: "Parlantes 8 Ω (10 W – 15 W)", spec: "Transductores BTL recomendados (1.392 A @ 100% PASS)", qty: "2", unit: 16.0, sub: 32.0 },
    { idx: 17, cat: "base", catLabel: "Base", name: "Miniprotoboard 170 puntos", spec: "Buses de señal lógica, acople AC y divisor 1k+2k", qty: "2", unit: 5.0, sub: 10.0 },
    { idx: 18, cat: "base", catLabel: "Base", name: "Cables Dupont y Conductores de Potencia", spec: "Interconexión ≤ 15 cm y rieles de +12V_SW / BTL", qty: "1 set", unit: 10.0, sub: 10.0 },
    { idx: 19, cat: "base", catLabel: "Base", name: "Carcasa / Panel MDF y Consumibles", spec: "Estructura física (zona táctil fresada ≤ 3 mm MDF)", qty: "1 lot", unit: 19.0, sub: 19.0 },
    { idx: 20, cat: "video", catLabel: "Video", name: "ESP32-C3 SuperMini (RISC-V 32 bits)", spec: "Coprocesador gráfico esclavo (4 MB Flash, 160 MHz, 3.3 V)", qty: "1", unit: 15.0, sub: 15.0 },
    { idx: 21, cat: "video", catLabel: "Video", name: 'Pantalla OLED 0.96" I2C SSD1306', spec: "Display gráfico 128 × 64 px @ 800 kHz (VCC → 3V3, 0x3C)", qty: "1", unit: 11.0, sub: 11.0 },
    { idx: 22, cat: "video", catLabel: "Video", name: "Módulo Lector MicroSD SPI (LDO 5V→3.3V)", spec: "Interfaz SPI 20 MHz (GPIO4..7 · VCC → +5.00V_REG)", qty: "1", unit: 5.0, sub: 5.0 },
    { idx: 23, cat: "video", catLabel: "Video", name: "Tarjeta MicroSD #2 (8 GB FAT32)", spec: "Almacenamiento dedicado /vid_01.bin../vid_04.bin (1024 B/cuadro)", qty: "1", unit: 12.0, sub: 12.0 }
  ];

  const bomBody = document.getElementById("bomTableBody");
  const bomSearch = document.getElementById("bomSearch");
  const bomFilterBtns = Array.from(document.querySelectorAll("#bomFilters .filter-btn"));
  let currentBomCat = "all";

  function renderBom() {
    if (!bomBody) return;
    const q = (bomSearch?.value || "").trim().toLowerCase();
    const filtered = BOM_ITEMS.filter((it) => {
      const catOk = currentBomCat === "all" || it.cat === currentBomCat;
      const qOk =
        !q ||
        it.name.toLowerCase().includes(q) ||
        it.spec.toLowerCase().includes(q) ||
        String(it.idx) === q;
      return catOk && qOk;
    });

    const rowsHtml = filtered
      .map(
        (it) => `
      <tr>
        <td class="mono">${it.idx}</td>
        <td><span class="badge ${it.cat === "base" ? "badge-navy" : "badge-teal"}">${it.catLabel}</span></td>
        <td><strong>${it.name}</strong></td>
        <td>${it.spec}</td>
        <td class="mono">${it.qty}</td>
        <td class="mono" style="text-align:right;">${it.unit.toFixed(2)}</td>
        <td class="mono" style="text-align:right;"><strong>${it.sub.toFixed(2)}</strong></td>
      </tr>`
      )
      .join("");

    const filteredSum = filtered.reduce((acc, it) => acc + it.sub, 0);
    const summaryRows =
      currentBomCat === "all" && !q
        ? `
      <tr class="subtotal-row">
        <td>—</td><td>Base</td><td colspan="4">Subtotal Sistema Base (19 ítems)</td>
        <td class="mono" style="text-align:right;">S/ 192.50</td>
      </tr>
      <tr class="subtotal-row">
        <td>—</td><td>Video</td><td colspan="4">Subtotal Expansión de Video (4 ítems)</td>
        <td class="mono" style="text-align:right;">S/ 43.00</td>
      </tr>
      <tr class="total-row">
        <td>—</td><td>TOTAL</td><td colspan="4">TOTAL GENERAL VALIDADO (23 ítems)</td>
        <td class="mono" style="text-align:right;">S/ 235.50</td>
      </tr>`
        : `
      <tr class="total-row">
        <td>—</td><td>FILTRO</td><td colspan="4">Subtotal Filtrado (${filtered.length} ítems)</td>
        <td class="mono" style="text-align:right;">S/ ${filteredSum.toFixed(2)}</td>
      </tr>`;

    bomBody.innerHTML = rowsHtml + summaryRows;
  }

  bomFilterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentBomCat = btn.dataset.bomcat;
      bomFilterBtns.forEach((b) => b.classList.toggle("active", b === btn));
      renderBom();
    });
  });

  bomSearch?.addEventListener("input", renderBom);
  renderBom();
})();
