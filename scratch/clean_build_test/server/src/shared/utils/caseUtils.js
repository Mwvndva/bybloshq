/**
 * Utility to convert snake_case database objects to camelCase
 */
export const toCamelCase = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    if (obj instanceof Date || obj instanceof Buffer) return obj;
    if (Array.isArray(obj)) return obj.map(v => toCamelCase(v));

    const newObj = {};
    Object.keys(obj).forEach(key => {
        const newKey = key.replace(/(_\w)/g, k => k[1].toUpperCase());
        newObj[newKey] = toCamelCase(obj[key]);
    });
    return newObj;
};

export default { toCamelCase };
