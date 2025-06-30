const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const pool = require('./db');
require('dotenv').config(); // 讀取 DATABASE_URL

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// 讓每個 req 可以使用 req.db 來存取 pool
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// 路由
const progressRoutes = require('./routes/progress');
app.use('/api', progressRoutes);

// 正式啟動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
