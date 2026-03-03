# Byblos DRM (Bybx) Fixes & Recommendations

This document outlines the required code changes to secure the DRM system and improve the user experience.

---

## 1. Security Fixes (Immediate)

### A. Move Decryption Server-Side (Recommended)
Providing the key to the client is inherently insecure.
- **Change**: Implement a streaming decryption proxy.
- **Logic**: User requests file -> Server verifies license -> Server streams encrypted data -> Decrypts on-the-fly -> Pipes to response with `Content-Type: application/pdf` etc.
- **Benefit**: The user never sees the key.

### B. Implement Watermarking
Since any decrypted content can be "screen recorded" or "printed to PDF", use forensic watermarking.
- **Fix**: In `server/src/utils/encryptor.js`, complete the `applyForensicWatermark` function.
- **Technique**: Embed the buyer's `email` or `order_id` as a hidden metadata field or invisible text layer in PDFs using `pdf-lib`.

---

## 2. Infrastructure Fixes

### C. Implement the Download Endpoint
Fix the stub in `server/src/controllers/order.controller.js`.

```javascript
// NEW implementation for downloadDigitalProduct
export const downloadDigitalProduct = async (req, res) => {
    const { orderId, productId } = req.params;
    const order = await Order.findById(orderId);
    
    // 1. Check if purchase is valid
    if (order.status !== 'completed') throw new Error('Payment required');

    // 2. Generate or Fetch Master Key
    let [activation] = await pool.query(
        'SELECT master_key FROM digital_activations WHERE order_id = $1 AND product_id = $2',
        [orderId, productId]
    );

    if (!activation) {
        const masterKey = crypto.randomBytes(32).toString('hex');
        await pool.query(
            'INSERT INTO digital_activations (order_id, product_id, master_key) VALUES ($1, $2, $3)',
            [orderId, productId, masterKey]
        );
        activation = { master_key: masterKey };
    }

    // 3. Encrypt and Stream
    const product = await Product.findById(productId);
    const bybxBuffer = await wrapFile(product.file_path, order.order_number, productId, activation.master_key);
    
    res.setHeader('Content-Disposition', `attachment; filename="${product.name}.bybx"`);
    res.send(bybxBuffer);
};
```

---

## 3. Usability Improvements

### D. Multi-Device Support
Update the database and controller to allow multiple devices.
- **Schema**: `ALTER TABLE digital_activations DROP COLUMN hardware_binding_id;`
- **New Table**: 
  ```sql
  CREATE TABLE activation_devices (
      activation_id UUID REFERENCES digital_activations(id),
      fingerprint VARCHAR(64),
      device_name TEXT
  );
  ```
- **Logic**: Allow up to 3 devices per activation record.

### E. Offline Access (Local License)
To allow offline reading:
1. When the user is online, download a **Device License** (a JWT signed by the server containing the `master_key`, encrypted with a local secret stored in `IndexedDB`).
2. `FileLaunchHandler` checks for this local license first. If found, it decrypts it using the local secret and opens the file without calling the API.

---

## 4. Architectural Shift: Watermarking vs DRM
If the burden of maintaining a custom `.bybx` player and handling browser compatibility is too high, consider **Social DRM**:
1. Flatten the DRM entirely.
2. Deliver standard PDFs/MP3s.
3. **Aggressively watermark** every page with "Purchased by: user@email.com (Order #12345)".
4. This removes the "won't open" complaints while providing a psychological deterrent to sharing.
