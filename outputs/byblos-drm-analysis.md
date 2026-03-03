# Byblos DRM (Bybx) System Analysis Report

## Executive Summary
The Bybx Digital Rights Management (DRM) system is designed to protect digital products (PDFs, Audio, etc.) from unauthorized sharing by encrypting them into a custom `.bybx` container and binding them to a specific device fingerprint.

However, the current implementation is **critically incomplete** and **insecure**. Files are stored unencrypted on the server, the download flow is stubbed, and the decryption logic is entirely client-side, making it trivial for a motivated user to bypass protection.

---

## 1. System Architecture & Flow

### A. Upload Flow (Seller → Platform)
- **Files**: `src/components/seller/AddProductForm.tsx`, `server/src/controllers/product.controller.js`
- **Mechanism**: Sellers upload digital files (PDF, ZIP, etc.) through the dashboard.
- **Flaw**: Files are saved in plaintext to `server/uploads/digital_products/`. No encryption occurs during upload.

### B. Purchase & License Generation
- **Files**: `server/migrations/archive/20260125_create_digital_activations.sql`
- **Mechanism**: A `master_key` (AES-256) is meant to be generated per purchase and stored in the `digital_activations` table.
- **Status**: The table exists, but the logic to populate it during checkout is missing or disconnected.

### C. Download Flow (Platform → Buyer)
- **Files**: `server/src/controllers/order.controller.js`, `server/src/utils/encryptor.js`
- **Mechanism**: The `downloadDigitalProduct` endpoint is intended to use `wrapFile` from `encryptor.js` to encrypt the plaintext file into a `.bybx` container on-the-fly.
- **Flaw**: This endpoint is currently a `501 Not Implemented` stub. Buyers cannot download protected files.

### D. Activation & Decryption (Buyer Device)
- **Files**: `src/components/FileLaunchHandler.tsx`, `src/contexts/BybxContext.tsx`, `src/lib/fingerprint.ts`
- **Mechanism**: 
  1. The buyer opens a `.bybx` file in the browser.
  2. `FileLaunchHandler` extracts the `orderNumber` and `productId` from the header.
  3. It calls `/api/activation/verify` with a device fingerprint.
  4. The server returns the `master_key`.
  5. The browser decrypts the file in RAM using the WebCrypto API (`AES-GCM`).
  6. `BybxContext` creates a `Blob` URL and opens it (PDF) or plays it (Audio).

---

## 2. Security Vulnerabilities

### [CRITICAL] Client-Side Decryption
The decryption key is sent to the client's browser. An attacker can:
- Open DevTools "Network" tab to see the `master_key` returned by `/api/activation/verify`.
- Use the key with a simple script to decrypt any `.bybx` file into its original format forever.

### [HIGH] Persistent Decrypted Blobs
The system uses `URL.createObjectURL(blob)`. 
- For PDFs, it calls `window.open(url)`, which opens the browser's native PDF viewer. The user can simply click "Save as" to keep a decrypted copy.
- Blobs stay in browser memory until the tab is closed, and are easily extractable.

### [MEDIUM] Weak Device Binding
`getDeviceFingerprint()` relies on attributes like `canvas` rendering, `WebGL` info, and `hardwareConcurrency`.
- These are not cryptographically secure identifiers.
- They can be spoofed by browser extensions or mirrored on identical hardware configurations.

### [MEDIUM] Unencrypted Server Storage
If the server is compromised, all original digital products are available in plaintext in the `uploads/` directory.

---

## 3. Usability Impact

### Multi-Device Friction
The current logic in `activation.controller.js` only allows **one** hardware binding per order item. If a user buys a book on their laptop and later tries to open it on their tablet, they will receive a "Hardware mismatch" error. There is no UI for device management.

### No Offline Access
The `FileLaunchHandler` **requires** a network request to `/api/activation/verify` every time the file is opened to get the decryption key. Users cannot read or listen to their purchases without an internet connection.

### Browser Limitations
The system depends on the [File Handling API](https://developer.mozilla.org/en-US/docs/Web/API/LaunchQueue), which is currently only supported in Chromium-based browsers (Chrome, Edge). Firefox and Safari users cannot "open" `.bybx` files directly.

---

## 4. Conclusion
The Bybx system provides a "speed bump" for casual users but offers zero protection against someone with basic technical knowledge. Its current state blocks legitimate users from downloading files while failing to stop piracy.
