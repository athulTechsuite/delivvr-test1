const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = process.env.DB_PATH || path.join(__dirname, '../database.sqlite');

const db = new sqlite3.Database(dbPath);
db.run(`CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  changed_by_user_id INTEGER NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
)`, (err) => {
    if (err) { console.error('Migration failed:', err); process.exit(1); }
    console.log('Migration complete: order_status_history table created');
    db.close();
});
