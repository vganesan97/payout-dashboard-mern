const express = require("express");
const router = express.Router();
const {getDb} = require("../conn");

router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const paymentsCollection = db.collection('payments');

        const uniqueFileIdsResult = await paymentsCollection.aggregate([
            { $group: { _id: "$fileId" } }
        ]).toArray();

        const uniqueFileIds = uniqueFileIdsResult.map(result => result._id);

        res.status(200).json({ uniqueFileIds });
    } catch (error) {
        console.error("Error fetching unique file IDs:", error);
        res.status(500).json({ error: "An error occurred while fetching unique file IDs." });
    }
});


module.exports = router;

