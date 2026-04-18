
// Mocking the environment to test normalizeOrderInput logic
const ProductType = { SERVICE: 'service', DIGITAL: 'digital', PHYSICAL: 'physical' };

function safeJson(val) {
    return (val && typeof val === 'object') ? val : {};
}

async function testNormalization(body, user, existingBuyer) {
    console.log("\n--- TESTING PAYLOAD ---");
    console.log("Input Body:", JSON.stringify(body));

    const {
        productId,
        productName,
        buyerLocation: rawBuyerLocation,
        metadata: rawMetadata = {},
    } = body;

    const metadata = safeJson(rawMetadata);

    // Simulating the resolution logic I want to implement
    const rawLocation = rawBuyerLocation || metadata.buyer_location || {};

    // THE FIX: Use nullish coalescing or explicit undefined check
    const resolveProp = (obj, props, fallback) => {
        for (const prop of props) {
            if (obj[prop] !== undefined && obj[prop] !== null) return obj[prop];
        }
        return fallback;
    };

    const lat = resolveProp(rawLocation, ['lat', 'latitude'], (user ? user.latitude : existingBuyer?.latitude));
    const lng = resolveProp(rawLocation, ['lng', 'longitude'], (user ? user.longitude : existingBuyer?.longitude));

    const location = {
        address: rawLocation.address || rawLocation.fullAddress || (user ? user.location : existingBuyer?.fullAddress || existingBuyer?.location) || null,
        lat: (lat === undefined || lat === null) ? null : Number.parseFloat(lat),
        lng: (lng === undefined || lng === null) ? null : Number.parseFloat(lng),
    };

    console.log("Resolved Location:", location);

    if (location.address === 'CBD' && !body.buyerLocation) {
        console.log("⚠️ WARNING: Defaulted to CBD!");
    }

    return location;
}

async function runTests() {
    // Case 1: Guest Mobile Service Booking with Map Coordinates (0.1, 36.8)
    await testNormalization({
        productId: 1,
        buyerLocation: { lat: 0.1, lng: 36.8, address: "My Home" },
        metadata: { product_type: 'service' }
    }, null, { location: 'CBD', latitude: -1.2, longitude: 36.8 });

    // Case 2: Guest Mobile Service Booking with 0,0 (Equator/Meridian edge case)
    await testNormalization({
        productId: 1,
        buyerLocation: { lat: 0, lng: 0, address: "Equator Point" },
        metadata: { product_type: 'service' }
    }, null, { location: 'CBD', latitude: -1.2, longitude: 36.8 });

    // Case 3: Guest with NO buyerLocation (Should fallback to CBD if profile has it)
    await testNormalization({
        productId: 1,
        metadata: { product_type: 'service' }
    }, null, { location: 'CBD', latitude: -1.2, longitude: 36.8 });
}

runTests();
