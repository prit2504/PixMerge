const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({
    origin: ['http://localhost:5173', 'https://pixmerge.netlify.app/'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true 
}));
app.use(express.json());

app.use('/api/image', require('./routes/image.manuplation.routes'));
app.use('/pdf', require('./routes/pdf.manuplation.routes'));

app.listen(5000, ()=> {
    console.log("Server running on PORT 5000");
});