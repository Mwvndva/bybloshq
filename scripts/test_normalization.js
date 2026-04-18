
// Mocking the environment to test robust normalizeOrderInput logic
const ProductType = { SERVICE: 'service', DIGITAL: 'digital', PHYSICAL: 'physical' };

async function testNormalization(body, user, existingBuyer) {
    console.log(`\n--- TESTING PAYLOAD [${body.testName || 'Unnamed'}] ---`);
    const {
        buyerLocation: rawBuyerLocation,
        metadata: rawMetadata = {},
    } = body;

    const metadata = (rawMetadata && typeof rawMetadata === 'object') ? rawMetadata : {};

    /**
     * TRIPLE-SHIELD LOCATION CRAWLER (PIN-COORD-ROBUST)
     */
    const crawlLocation = () => {
        const candidates = [
            body.buyerLocation,
            body.buyer_location,
            metadata.buyer_location,
            metadata.buyerLocation
        ];

        const result = { lat: null, lng: null, address: null, source: 'none' };

        for (let i = 0; i < candidates.length; i++) {
            let candidate = candidates[i];
            if (!candidate) continue;

            // Defensive: Parse stringified JSON if it arrived as a string
            if (typeof candidate === 'string') {
                try {
                    candidate = JSON.parse(candidate);
                } catch (e) {
                    continue; // Not JSON string, skip
                }
            }

            if (typeof candidate !== 'object') continue;

            // Property Scanning (lat/latitude/lng/longitude)
            const lat = candidate.lat ?? candidate.latitude ?? candidate.location_lat;
            const lng = candidate.lng ?? candidate.longitude ?? candidate.location_lng;
            const addr = candidate.address || candidate.fullAddress || candidate.full_address || candidate.location_address;

            if (lat !== undefined && lat !== null) result.lat = Number.parseFloat(lat);
            if (lng !== undefined && lng !== null) result.lng = Number.parseFloat(lng);
            if (addr) result.address = addr;

            if (result.lat !== null && result.lng !== null) {
                result.source = ['body.buyerLocation', 'body.buyer_location', 'metadata.buyer_location', 'metadata.buyerLocation'][i];
                break; // Found complete coordinates
            }
        }

        // Profile Fallback
        if (result.lat === null || result.lng === null) {
            if (user) {
                result.lat = result.lat ?? user.latitude;
                result.lng = result.lng ?? user.longitude;
                result.address = result.address ?? user.location;
                result.source = 'user_profile';
            } else if (existingBuyer) {
                result.lat = result.lat ?? existingBuyer.latitude;
                result.lng = result.lng ?? existingBuyer.longitude;
                result.address = result.address ?? (existingBuyer.fullAddress || existingBuyer.location);
                result.source = 'buyer_profile';
            }
        }

        return result;
    };

    const resolved = crawlLocation();
    const location = {
        address: resolved.address || null,
        lat: resolved.lat,
        lng: resolved.lng
    };

    console.log("Resolved Location:", location);
    console.log("Source:", resolved.source);

    return location;
}

async function runTests() {
    // Case 1: Normal Object
    await testNormalization({
        testName: 'Normal Object',
        productId: 1,
        buyerLocation: { lat: 0.1, lng: 36.8, address: "My Home" },
        metadata: { product_type: 'service' }
    });

    // Case 2: Stringified JSON (The suspected failure mode on VPS)
    await testNormalization({
        testName: 'Stringified JSON',
        productId: 1,
        buyerLocation: JSON.stringify({ lat: -1.2, lng: 36.9, address: "JSON String Home" }),
        metadata: { product_type: 'service' }
    });

    // Case 3: Proper fallback to Profile
    await testNormalization({
        testName: 'Profile Fallback',
        productId: 1,
        metadata: { product_type: 'service' }
    }, { latitude: -1.2921, longitude: 36.8219, location: 'Nairobi HQ' });

    // Case 4: Misnamed snake_case in metadata
    await testNormalization({
        testName: 'Snake Case in Metadata',
        productId: 1,
        metadata: {
            product_type: 'service',
            buyer_location: { latitude: -4.0, longitude: 39.0, full_address: "Mombasa Port" }
        }
    });
}

runTests();
