const EARTH_RADIUS_KM = 6371;
const DEFAULT_RATE_KES_PER_KM = 40;
const DEFAULT_SELLER_PICKUP_CBD_FEE_KES = 100;
const DEFAULT_SELLER_PICKUP_CBD_RADIUS_KM = 3;
const DEFAULT_HUB = Object.freeze({
    label: 'Byblos CBD Hub',
    address: 'Dynamic Mall, Tom Mboya St, Nairobi | Shop SL 32',
    latitude: -1.286389,
    longitude: 36.817223
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
    return Math.round(Number(amount) * 100) / 100;
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

    if (latitude < -90 || latitude > 90) {
        throw new Error(`${label}.latitude must be between -90 and 90`);
    }

    if (longitude < -180 || longitude > 180) {
        throw new Error(`${label}.longitude must be between -180 and 180`);
    }

    return {
        label: location.label || null,
        address: location.address || location.full_address || location.fullAddress || null,
        latitude,
        longitude
    };
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

class LogisticsQuoteService {
    static getConfiguredHub(env = process.env) {
        return normalizeLocation({
            label: env.LOGISTICS_HUB_LABEL || DEFAULT_HUB.label,
            address: env.LOGISTICS_HUB_ADDRESS || env.DROPOFF_LOCATION || DEFAULT_HUB.address,
            latitude: parseOptionalNumber(
                env.LOGISTICS_HUB_LATITUDE,
                DEFAULT_HUB.latitude,
                'LOGISTICS_HUB_LATITUDE'
            ),
            longitude: parseOptionalNumber(
                env.LOGISTICS_HUB_LONGITUDE,
                DEFAULT_HUB.longitude,
                'LOGISTICS_HUB_LONGITUDE'
            )
        }, 'hub');
    }

    static getConfiguredRate(env = process.env) {
        const legacyDoorDeliveryRate = parseOptionalNumber(
            env.DOOR_DELIVERY_RATE_KES_PER_KM,
            DEFAULT_RATE_KES_PER_KM,
            'DOOR_DELIVERY_RATE_KES_PER_KM'
        );

        if (legacyDoorDeliveryRate < 0) {
            throw new Error('DOOR_DELIVERY_RATE_KES_PER_KM cannot be negative');
        }

        const rate = parseOptionalNumber(
            env.LOGISTICS_RATE_KES_PER_KM,
            legacyDoorDeliveryRate,
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

        return roundMoney(Math.ceil(distance) * rate);
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
}

export {
    DEFAULT_HUB,
    DEFAULT_RATE_KES_PER_KM,
    DEFAULT_SELLER_PICKUP_CBD_FEE_KES,
    DEFAULT_SELLER_PICKUP_CBD_RADIUS_KM,
    LogisticsQuoteService
};

export default LogisticsQuoteService;
