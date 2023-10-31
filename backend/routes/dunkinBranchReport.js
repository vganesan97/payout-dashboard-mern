const express = require('express');
require("dotenv").config({ path: "./config.env" });
const {sendToQueue} = require("../mq/producer");
const router = express.Router();
const {getDb} = require("../conn");
const Papa = require('papaparse');

router.get('/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    const db = getDb();
    const paymentsCollection = db.collection('payments');
    const aggregatedResults = await paymentsCollection.aggregate([
        {
            $addFields: {
                "amountNumber": {
                    $toDouble: {
                        $substr: [ "$amount", 1, -1 ]
                    }
                }
            }
        },
        {
            $group: {
                _id: "$employee.dunkinBranch",
                totalAmount: { $sum: "$amountNumber" }
            }
        },
        {
            $addFields: {
                "totalAmount": {
                    $round: ["$totalAmount", 2]
                }
            }
        },
        {
            $sort: {
                totalAmount: -1
            }
        }
    ]).toArray();

    aggregatedResults.forEach(item => {
        item.totalAmount = item.totalAmount.toFixed(2);
    });

    // Convert MongoDB data to CSV
    const csv = Papa.unparse(aggregatedResults);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=DunkinBranchesReport_${fileId}.csv`);
    res.status(200).send(csv);
});


module.exports = router;
