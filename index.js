const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const router = require('./routers/router');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/api', router);

app.listen(PORT, () => console.log(`server listening on port ${PORT}!`));

