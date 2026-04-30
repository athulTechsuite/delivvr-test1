require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const email = process.argv[2];
if (!email) {
    console.error('Usage: node database/seed-admin.js <email>');
    process.exit(1);
}

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

db.run(
    `UPDATE users SET role = 'admin' WHERE email = ?`,
    [email],
    function (err) {
        if (err) {
            console.error('Failed to promote user:', err.message);
            db.close();
            process.exit(1);
        }
        if (this.changes === 0) {
            console.error(`No user found with email: ${email}`);
            db.close();
            process.exit(1);
        }
        console.log(`Success: ${email} has been promoted to admin.`);
        db.close();
    }
);
