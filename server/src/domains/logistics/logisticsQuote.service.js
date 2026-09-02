const EARTH_RADIUS_KM = 6371;
const DEFAULT_RATE_KES_PER_KM = 40;
const DEFAULT_SELLER_PICKUP_CBD_FEE_KES = 100;
const DEFAULT_SELLER_PICKUP_CBD_RADIUS_KM = 3;
const DEFAULT_HUB = Object.freeze({
    label: 'MZIGO EGO',
    address: 'Dynamic mall shop sl32',
    latitude: -1.2836,
    longitude: 36.8249
});

function parseNumber(value, fieldName) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        throw new Error(`${fieldName} must be a finite number`);
    }
    return number;
}

function parseOptionalNumber(value, fallback, fieldName) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    return parseNumber(value, fieldName);
}

function roundMoney(amount) {
    return Math.ceil(Number(amount));
}

function normalizeLocation(location = {}, label = 'location') {
    const latitude = parseNumber(
        location.latitude ?? location.lat,
        `${label}.latitude`
    );
    const longitude = parseNumber(
        location.longitude ?? location.lng ?? location.lon,
        `${label}.longitude`
    );

    if (latitude === 0 && longitude === 0) {
        throw new Error(`Valid ${label} coordinates are required`);
    }

    let finalLat = latitude;
    if (finalLat > 0 && finalLat < 5 && longitude > 34 && longitude < 42) {
        finalLat = -finalLat;
    }

    if (finalLat < -90 || finalLat > 90) {
        throw new Error(`${label}.latitude must be between -90 and 90`);
    }

    if (longitude < -180 || longitude > 180) {
        throw new Error(`${label}.longitude must be between -180 and 180`);
    }

    return {
        label: location.label || null,
        address: location.address || location.full_address || location.fullAddress || null,
        latitude: finalLat,
        longitude
    };
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

class LogisticsQuoteService {
    static getConfiguredHub(env = process.env) {
        let lat = parseOptionalNumber(
            env.LOGISTICS_HUB_LATITUDE,
            DEFAULT_HUB.latitude,
            'LOGISTICS_HUB_LATITUDE'
        );
        const lng = parseOptionalNumber(
            env.LOGISTICS_HUB_LONGITUDE,
            DEFAULT_HUB.longitude,
            'LOGISTICS_HUB_LONGITUDE'
        );
        if (lat > 0 && lat < 5 && lng > 34 && lng < 42) {
            lat = -lat;
        }

        return normalizeLocation({
            label: env.LOGISTICS_HUB_LABEL || DEFAULT_HUB.label,
            address: env.LOGISTICS_HUB_ADDRESS || env.DROPOFF_LOCATION || DEFAULT_HUB.address,
            latitude: lat,
            longitude: lng
        }, 'hub');
    }

    static getConfiguredRate(env = process.env) {
        const rate = parseOptionalNumber(
            env.LOGISTICS_RATE_KES_PER_KM,
            DEFAULT_RATE_KES_PER_KM,
            'LOGISTICS_RATE_KES_PER_KM'
        );

        if (rate < 0) {
            throw new Error('LOGISTICS_RATE_KES_PER_KM cannot be negative');
        }

        return rate;
    }

    static getSellerPickupCbdFee(env = process.env) {
        const fee = parseOptionalNumber(
            env.SELLER_PICKUP_CBD_FEE_KES,
            DEFAULT_SELLER_PICKUP_CBD_FEE_KES,
            'SELLER_PICKUP_CBD_FEE_KES'
        );

        if (fee < 0) {
            throw new Error('SELLER_PICKUP_CBD_FEE_KES cannot be negative');
        }

        return fee;
    }

    static getSellerPickupCbdRadiusKm(env = process.env) {
        const radius = parseOptionalNumber(
            env.SELLER_PICKUP_CBD_RADIUS_KM,
            DEFAULT_SELLER_PICKUP_CBD_RADIUS_KM,
            'SELLER_PICKUP_CBD_RADIUS_KM'
        );

        if (radius < 0) {
            throw new Error('SELLER_PICKUP_CBD_RADIUS_KM cannot be negative');
        }

        return radius;
    }

    static calculateDistanceKm(origin, destination) {
        const normalizedOrigin = normalizeLocation(origin, 'origin');
        const normalizedDestination = normalizeLocation(destination, 'destination');

        const dLat = toRadians(normalizedDestination.latitude - normalizedOrigin.latitude);
        const dLng = toRadians(normalizedDestination.longitude - normalizedOrigin.longitude);
        const originLat = toRadians(normalizedOrigin.latitude);
        const destinationLat = toRadians(normalizedDestination.latitude);

        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return Math.round(EARTH_RADIUS_KM * c * 1000) / 1000;
    }

    static calculateFeeForDistance(distanceKm, rateKesPerKm = this.getConfiguredRate()) {
        const distance = parseNumber(distanceKm, 'distanceKm');
        const rate = parseNumber(rateKesPerKm, 'rateKesPerKm');

        if (distance < 0) {
            throw new Error('distanceKm cannot be negative');
        }

        if (rate < 0) {
            throw new Error('rateKesPerKm cannot be negative');
        }

        return Math.ceil(Math.ceil(distance) * rate);
    }

    static quoteBuyerDoorDelivery(buyerLocation, options = {}) {
        const hub = options.hub
            ? normalizeLocation(options.hub, 'hub')
            : this.getConfiguredHub(options.env);
        const destination = normalizeLocation(buyerLocation, 'buyerLocation');
        const rateKesPerKm = options.rateKesPerKm ?? this.getConfiguredRate(options.env);
        const distanceKm = this.calculateDistanceKm(hub, destination);
        const feeAmount = this.calculateFeeForDistance(distanceKm, rateKesPerKm);

        return {
            legType: 'delivery',
            payer: 'buyer',
            currency: 'KES',
            rateKesPerKm,
            distanceKm,
            chargeableDistanceKm: Math.ceil(distanceKm),
            feeAmount,
            origin: hub,
            destination
        };
    }

    static async quoteBuyerDoorDeliveryAsync(buyerLocation, options = {}) {
        const hub = options.hub ? normalizeLocation(options.hub, 'hub') : this.getConfiguredHub(options.env);
        const destination = normalizeLocation(buyerLocation, 'buyerLocation');
        const originHash = `${hub.latitude.toFixed(4)}_${hub.longitude.toFixed(4)}`;
        const destHash = `${destination.latitude.toFixed(4)}_${destination.longitude.toFixed(4)}`;
        const cacheKey = `logistics:quote:delivery:${originHash}:${destHash}`;

        try {
            const { default: getRedisClient } = await import('../../shared/config/redis.js');
            const redis = getRedisClient();
            const cached = await redis.get(cacheKey);
            if (cached) return JSON.parse(cached);

            const quote = this.quoteBuyerDoorDelivery(buyerLocation, options);
            await redis.set(cacheKey, JSON.stringify(quote), 'EX', 86400); // 24-hour TTL
            return quote;
        } catch {
            return this.quoteBuyerDoorDelivery(buyerLocation, options);
        }
    }

    static quoteSellerPickup(sellerPickupLocation, options = {}) {
        const hub = options.hub
            ? normalizeLocation(options.hub, 'hub')
            : this.getConfiguredHub(options.env);
        const origin = normalizeLocation(sellerPickupLocation, 'sellerPickupLocation');
        const rateKesPerKm = options.rateKesPerKm ?? this.getConfiguredRate(options.env);
        const distanceKm = this.calculateDistanceKm(hub, origin);
        const cbdRadiusKm = options.cbdRadiusKm ?? this.getSellerPickupCbdRadiusKm(options.env);
        const cbdPickupFeeKes = options.cbdPickupFeeKes ?? this.getSellerPickupCbdFee(options.env);
        const isWithinCbd = distanceKm <= cbdRadiusKm;
        const feeAmount = isWithinCbd
            ? roundMoney(cbdPickupFeeKes)
            : this.calculateFeeForDistance(distanceKm, rateKesPerKm);

        return {
            legType: 'pickup',
            payer: 'seller',
            currency: 'KES',
            rateKesPerKm,
            distanceKm,
            chargeableDistanceKm: Math.ceil(distanceKm),
            feeAmount,
            pricingModel: isWithinCbd ? 'cbd_flat' : 'distance_rate',
            cbdRadiusKm,
            cbdPickupFeeKes,
            origin,
            destination: hub
        };
    }

    static async quoteSellerPickupAsync(sellerPickupLocation, options = {}) {
        const hub = options.hub ? normalizeLocation(options.hub, 'hub') : this.getConfiguredHub(options.env);
        const origin = normalizeLocation(sellerPickupLocation, 'sellerPickupLocation');
        const originHash = `${origin.latitude.toFixed(4)}_${origin.longitude.toFixed(4)}`;
        const destHash = `${hub.latitude.toFixed(4)}_${hub.longitude.toFixed(4)}`;
        const cacheKey = `logistics:quote:pickup:${originHash}:${destHash}`;

        try {
            const { default: getRedisClient } = await import('../../shared/config/redis.js');
            const redis = getRedisClient();
            const cached = await redis.get(cacheKey);
            if (cached) return JSON.parse(cached);

            const quote = this.quoteSellerPickup(sellerPickupLocation, options);
            await redis.set(cacheKey, JSON.stringify(quote), 'EX', 86400); // 24-hour TTL
            return quote;
        } catch {
            return this.quoteSellerPickup(sellerPickupLocation, options);
        }
    }
}

export {
    DEFAULT_HUB,
    DEFAULT_RATE_KES_PER_KM,
    DEFAULT_SELLER_PICKUP_CBD_FEE_KES,
    DEFAULT_SELLER_PICKUP_CBD_RADIUS_KM,
    LogisticsQuoteService
};

export default LogisticsQuoteService;
