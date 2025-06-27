const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'progressdb',
  password: '9527',
  port: 5432,
});

module.exports = pool;
