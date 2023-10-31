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
    const aggregatedResults2 = await paymentsCollection.aggregate([
        {
            $match: {
                "fileId": fileId
            }
        },
        {
            $addFields: {
                "amountInCents": "$methodPayment.amount"
            }
        },
        {
            $group: {
                _id: "$methodPayment.source",
                totalAmountInCents: { $sum: "$amountInCents" }
            }
        },
        {
            $addFields: {
                "totalAmount": {
                    $round: [
                        { $divide: ["$totalAmountInCents", 100] },
                        2
                    ]
                }
            }
        },
        {
            $project: {
                _id: 1,
                totalAmount: 1
            }
        },
        {
            $sort: {
                totalAmount: -1
            }
        }
    ]).toArray();

    aggregatedResults2.forEach(item => {
        item.totalAmount = item.totalAmount.toFixed(2);
    });

    // Convert MongoDB data to CSV
    const csv = Papa.unparse(aggregatedResults2);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=TotalFundsPerSourceReport_${fileId}.csv`);
    res.status(200).send(csv);
});


module.exports = router;
