require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('ERROR: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
    process.exit(1);
}

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Failed to connect to database:', err.message);
        process.exit(1);
    }
});

const SALT_ROUNDS = 10;

(async () => {
    try {
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

        db.serialize(() => {
            // Ensure role column exists before upserting
            db.run(
                `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'customer'`,
                (err) => {
                    if (err && !err.message.includes('duplicate column name')) {
                        console.error('Migration warning:', err.message);
                    }
                }
            );

            db.run(
                `INSERT INTO users (name, email, password, role)
                 VALUES ('Admin', ?, ?, 'admin')
                 ON CONFLICT(email) DO UPDATE SET
                     password = excluded.password,
                     role     = 'admin'`,
                [ADMIN_EMAIL, hashedPassword],
                function (err) {
                    if (err) {
                        console.error('Failed to upsert admin user:', err.message);
                        db.close();
                        process.exit(1);
                    }
                    console.log(`Admin user seeded successfully: ${ADMIN_EMAIL}`);
                    db.close();
                }
            );
        });
    } catch (err) {
        console.error('Unexpected error:', err.message);
        db.close();
        process.exit(1);
    }
})();
