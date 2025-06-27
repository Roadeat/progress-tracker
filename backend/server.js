const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

const progressRoutes = require('./routes/progress');
app.use('/api', progressRoutes);

app.listen(3000, () => console.log('Server running at http://localhost:3000'));