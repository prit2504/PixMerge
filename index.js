const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/image', require('./routes/image.manuplation.routes'));
app.use('/pdf', require('./routes/pdf.manuplation.routes'));

app.listen(5000, ()=> {
    console.log("Server running on PORT 5000");
});