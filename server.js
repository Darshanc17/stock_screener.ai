const express = require('express');
const path = require('path');
const analyzeHandler = require('./api/analyze.js');
const searchHandler = require('./api/search.js');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Mock the Vercel (req, res) handler slightly if needed, but Express req, res usually work fine
app.post('/api/analyze', analyzeHandler);
app.get('/api/search', searchHandler);

app.use(express.static(path.join(__dirname, 'public')));



const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running locally at http://localhost:${PORT}`);
    console.log('You can test the application in your browser.');
});
