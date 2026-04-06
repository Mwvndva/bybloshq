export async function up(pgm) {
    pgm.createTable('pending_registrations', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('uuid_generate_v4()'),
        },
        email: {
            type: 'varchar(255)',
            notNull: true,
            unique: true,
        },
        password_hash: {
            type: 'varchar(255)',
            notNull: true,
        },
        role: {
            type: 'varchar(50)',
            notNull: true,
            check: "role IN ('buyer', 'seller')",
        },
        registration_data: {
            type: 'jsonb',
            notNull: true,
        },
        verification_token: {
            type: 'varchar(255)',
            notNull: true,
        },
        expires_at: {
            type: 'timestamptz',
            notNull: true,
        },
        created_at: {
            type: 'timestamptz',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });

    pgm.createIndex('pending_registrations', 'email', { name: 'idx_pending_registrations_email' });
    pgm.createIndex('pending_registrations', 'verification_token', { name: 'idx_pending_registrations_token' });
}

export async function down(pgm) {
    pgm.dropTable('pending_registrations');
}
