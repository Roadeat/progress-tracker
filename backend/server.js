const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// 註冊路由
const progressRoutes = require('./routes/progress');
app.use('/api', progressRoutes);

// ✅ 只留這一段 listen，使用 Render 要求的 PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 加一個首頁的簡單路由
app.get('/', (req, res) => {
  res.send('🚀 Progress Tracker backend is running!');
});
