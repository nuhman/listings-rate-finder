const service = require('./service');

exports.getListings = async function (req, res, next) {

    var listingsCount = req.params.listingsCount || 51;

    try {
        var listingsData = await service.getAllListings(listingsCount);
        return res.status(200).json({ status: 200, data: listingsData, message: "Succesfull" });
    } catch (e) {
        return res.status(400).json({ status: 400, message: e.message });
    }

}




