
export const up = async (pgm) => {
    // Add terms_accepted columns to buyers
    pgm.addColumn('buyers', {
        terms_accepted: { type: 'boolean', default: false, notNull: true },
        terms_accepted_at: { type: 'timestamp', allowNull: true }
    });

    // Add terms_accepted columns to sellers
    pgm.addColumn('sellers', {
        terms_accepted: { type: 'boolean', default: false, notNull: true },
        terms_accepted_at: { type: 'timestamp', allowNull: true }
    });

    // Add terms_accepted columns to pending_registrations
    pgm.addColumn('pending_registrations', {
        terms_accepted: { type: 'boolean', default: false, notNull: true },
        terms_accepted_at: { type: 'timestamp', allowNull: true }
    });
};

export const down = async (pgm) => {
    pgm.dropColumn('buyers', ['terms_accepted', 'terms_accepted_at']);
    pgm.dropColumn('sellers', ['terms_accepted', 'terms_accepted_at']);
    pgm.dropColumn('pending_registrations', ['terms_accepted', 'terms_accepted_at']);
};
