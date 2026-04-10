import pg from 'pg';

export const up = async (pgm) => {
    pgm.addColumn('products', {
        digital_file_size: { type: 'bigint', allowNull: true }
    });
};

export const down = async (pgm) => {
    pgm.dropColumn('products', 'digital_file_size');
};
