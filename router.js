const express = require('express');
const router = express.Router();

const _Controller = require('./controller');

router.get('/', _Controller.getListings);

module.exports = router;
