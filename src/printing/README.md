# Printing Module

Folder yang disarankan:

```text
src/
  printing/
    adapters/
      BrowserPrintAdapter.ts
      LocalServicePrintAdapter.ts
      QzTrayPrintAdapter.ts
      TcpEscPosPrintAdapter.ts
    __tests__/
      receiptHelpers.test.ts
      renderReceiptText.test.ts
    EscPosBuilder.ts
    PrinterSettingsForm.tsx
    dummyData.ts
    generateTestReceipt.ts
    index.ts
    printReceipt.ts
    profiles.ts
    receiptHelpers.ts
    renderReceiptText.ts
    types.ts
```

Contoh penggunaan:

```ts
import {
  DEFAULT_PRINTER_PROFILES,
  generateTestReceipt,
  printReceipt,
  sampleReceipt,
} from './index';

await printReceipt(sampleReceipt, DEFAULT_PRINTER_PROFILES.thermal58);
await printReceipt(generateTestReceipt(DEFAULT_PRINTER_PROFILES.browserFallback), DEFAULT_PRINTER_PROFILES.browserFallback);
```

Catatan integrasi:

- Web app:
  gunakan `QzTrayPrintAdapter` untuk raw ESC/POS dan `BrowserPrintAdapter` sebagai fallback.
- Android wrapper:
  sambungkan adapter ke native bridge, WebUSB, WebBluetooth, atau local service.
- Desktop / local service:
  jalankan raw TCP/USB dari Electron main process atau service lokal, lalu gunakan `LocalServicePrintAdapter`.
- LAN printer:
  `TcpEscPosPrintAdapter` saat ini sengaja berupa stub karena browser tidak bisa membuka socket TCP 9100 langsung.
