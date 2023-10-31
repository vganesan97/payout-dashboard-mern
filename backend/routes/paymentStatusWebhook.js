const express = require("express");
const router = express.Router();
const {getDb} = require("../conn");
const {Method, Environments} = require("method-node");
router.post('/', async (req, res) => {
    try {
        // Parse the incoming JSON request body
        const { id, type, op } = req.body;

        // Validate request (you may want to validate type and op as well)
        if (!id) {
            return res.status(400).json({ error: "Payment ID is missing." });
        }

        const db = getDb();
        const paymentsCollection = db.collection('payments');

        const method = new Method({
            apiKey: process.env.METHOD_KEY,
            env: Environments.dev,
        });

        const payment = await method.payments.get(id);

        // Update the methodPayment.status field of the document that matches the payment ID
        const updateResult = await paymentsCollection.updateOne(
            { "methodPayment.id": id },
            { $set: { "methodPayment.status": payment.status } }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ error: "No payment found with the provided ID." });
        }

        res.status(200).json({ message: "Payment status updated successfully." });

    } catch (error) {
        console.error("Error in webhook:", error);
        res.status(500).json({ error: "An error occurred while processing the webhook." });
    }
});

module.exports = router;

