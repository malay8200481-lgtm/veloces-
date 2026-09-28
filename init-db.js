require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

(async () => {
  let db;

  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    });

    const schemaPath = path.join(__dirname, "schema.sql");
    let schema = fs.readFileSync(schemaPath, "utf8");

    // Railway already provides the database.
    // Remove the local CREATE DATABASE / USE commands.
    schema = schema
      .replace(/CREATE DATABASE IF NOT EXISTS veloces[^;]*;/i, "")
      .replace(/USE veloces\s*;/i, "");

    await db.query(schema);

    console.log("Database tables created successfully.");
    await db.end();
    process.exit(0);
  } catch (error) {
    console.error("Database initialization failed:");
    console.error(error);
    if (db) await db.end();
    process.exit(1);
  }
})();
