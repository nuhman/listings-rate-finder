const express = require('express');
const router = express.Router();

const _Controller = require('../controllers/controller');

router.post('/listings', _Controller.getListings);
router.post('/location', _Controller.getSuggestedLocations);

module.exports = router;
