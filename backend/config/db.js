// backend/config/db.js

const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

connection.connect((error) => {
  if (error) {
    console.error('Database Connection Failed:');
    console.error(error);
    process.exit(1); // Exit if DB fails
  } else {
    console.log('MySQL Connected Successfully');
  }
});

module.exports = connection;