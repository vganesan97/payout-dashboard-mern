const express = require('express');
require("dotenv").config({ path: "./config.env" });
const {sendToQueue} = require("../mq/producer");
const router = express.Router();

router.post('/', async (req, res) => {
    const fileId = req.headers['file-id'];  // Get the file ID from header
    const rows = req.body // If the rows are sent as a JSON array in the request body
    const processRowsWithoutPromise = (rows, fileId) => {
        rows.forEach((row, index) => { sendToQueue(JSON.stringify(row)) });
    };
    processRowsWithoutPromise(rows, fileId);
    res.status(200).send(`All payments sent to queue`);
});


module.exports = router;
