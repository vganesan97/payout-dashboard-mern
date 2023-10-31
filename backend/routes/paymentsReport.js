const express = require('express');
require("dotenv").config({ path: "./config.env" });
const router = express.Router();
const {getDb} = require("../conn");
const Papa = require('papaparse');

function flattenObject(ob) {
    const toReturn = {};
    for (const i in ob) {
        if ((typeof ob[i]) === 'object' && !Array.isArray(ob[i])) {
            const temp = flattenObject(ob[i]);
            for (const j in temp) {
                toReturn[i + '.' + j] = temp[j];
            }
        } else {
            toReturn[i] = ob[i];
        }
    }
    return toReturn;
}

router.get('/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    const db = getDb();
    const paymentsCollection = db.collection('payments');
    const paymentDocs = await paymentsCollection.find({
        "fileId": fileId
    }).toArray();

    // Flatten each document for proper CSV formatting
    const flatPaymentDocs = paymentDocs.map(doc => flattenObject(doc));

    // Convert MongoDB data to CSV
    const csv = Papa.unparse(flatPaymentDocs);

    // Send CSV as response
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=AllFieldsPaymentReport_${fileId}.csv`);
    res.status(200).send(csv);
});

module.exports = router;
