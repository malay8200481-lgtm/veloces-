require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  const email = "admin@veloces.local";
  const password = "ChangeMe123!";
  const hash = await bcrypt.hash(password, 12);
  await db.execute(
    "INSERT IGNORE INTO users(name,email,password_hash,role) VALUES(?,?,?,'ADMIN')",
    ["Veloces Administrator", email, hash]
  );
  console.log(`Seed admin: ${email} / ${password} (change it immediately)`);
  await db.end();
})();
