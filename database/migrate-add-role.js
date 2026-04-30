require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

db.run(
    `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`,
    (err) => {
        if (err) {
            if (err.message.includes('duplicate column')) {
                console.log('Migration already applied — role column exists.');
            } else {
                console.error('Migration failed:', err.message);
                process.exit(1);
            }
        } else {
            console.log('Migration applied: role column added to users table.');
        }
        db.close();
    }
);
