const service = require('./service');

exports.getListings = async function (req, res, next) {

    const listingsCount = req.body?.listingsCount || 50;
    let location = req.body?.location || "73 w monroe st chicago il usa";

    try {
        location = await service.getSuggestedLocation(location);
        const listingsData = await service.getAllListings(listingsCount, location?.suggestedLocation);
        return res.status(200).json({ status: 200, result: listingsData, message: "Succesfull" });
    } catch (e) {
        return res.status(400).json({ status: 400, message: e.message });
    }

}

exports.getSuggestedLocations = async function (req, res, next) {

    let location = req.body?.location;

    try {
        location = await service.getSuggestedLocation(location);
        return res.status(200).json({ status: 200, result: location, message: "Succesfull" });
    } catch (e) {
        return res.status(400).json({ status: 400, message: e.message });
    }

}




