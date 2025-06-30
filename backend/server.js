const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config(); // 載入 .env 環境變數

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// 連接 Supabase 資料庫
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Supabase 要求使用 SSL
  },
});

// 將 pool 放進 request 中，讓 routes 可以取用
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// 註冊路由
const progressRoutes = require('./routes/progress');
app.use('/api', progressRoutes);

// 測試首頁
app.get('/', (req, res) => {
  res.send('🚀 Progress Tracker backend is running!');
});

// 伺服器啟動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
