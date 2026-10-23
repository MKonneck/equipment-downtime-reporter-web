# Equipment Downtime Reporter (web)
Offline PWA port of the Android EquipmentDowntimeReporter app. Vanilla HTML/CSS/JS.
- `logic.js` – Lot ID + report logic ported 1:1 from Kotlin
- `node tests/run-tests.js` – checks against expected Kotlin outputs
- Serve the folder over HTTPS (service worker needs it) and "Add to Home Screen" on iPhone.
The HilariousBit easter egg is intentionally excluded.
