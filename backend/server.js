const express = require("express");
const uploadRoute = require('./routes/uploadRoute'); // Adjust the path as necessary
const paymentStatusWebhook = require('./routes/uploadRoute'); // Adjust the path as necessary
const uniqueFileIds = require('./routes/uniqueFileIds'); // Adjust the path as necessary
const dunkinBranchReport = require('./routes/dunkinBranchReport'); // Adjust the path as necessary
const totalFundsPerSource = require('./routes/totalFundsPerSource'); // Adjust the path as necessary
const paymentsReport = require('./routes/paymentsReport'); // Adjust the path as necessary
const { Method, Environments } = require('method-node');
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const dbo = require("./conn");
const {startConsumer} = require("./mq/consumer");
const {getDb} = require("./conn");
require("dotenv").config({ path: "./config.env" });

app.use(cors());
app.use(express.json());
app.use('/upload', uploadRoute);
app.use('/paymentStatusWebhook', paymentStatusWebhook)
app.use('/uniqueFileIds', uniqueFileIds);
app.use('/totalFundsPerSource', totalFundsPerSource);
app.use('/dunkinBranchReport', dunkinBranchReport);
app.use('/paymentsReport', paymentsReport);


app.listen(port, async () => {
    await dbo.connectToServer(function (err) {
        if (err) console.error(err);
    });
    startConsumer()

    const method = new Method({
        apiKey: process.env.METHOD_KEY,
        env: Environments.dev,
    });

    const webhook = await method.webhooks.create({
        type: 'payment.update',
        url: 'https://localhost:5000/paymentStatusWebhook',
    });

    const db = getDb();
    const paymentsCollection = db.collection('payments');

    method.ping().then(r => console.log("method connection:", r))
    console.log(`Server is running on port: ${port}`);

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
            $sort: {
                totalAmount: -1
            }
        }
    ]).toArray();

    const aggregatedResults2 = await paymentsCollection.aggregate([
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
                    $divide: ["$totalAmountInCents", 100]
                }
            }
        },
        {
            $sort: {
                totalAmount: -1
            }
        }
    ]).toArray();

    console.log("Total Amounts paid by each Dunkin Branch:");
    aggregatedResults.forEach(result => {
        console.log(`- ${result._id}: $${result.totalAmount.toFixed(2)}`);
    });
    console.log()

    console.log("Total Amounts paid out per unique source account");
    aggregatedResults2.forEach(result => {
        console.log(`- ${result._id}: $${result.totalAmount.toFixed(2)}`);
    });


    try {
        const [results, results2, results3, results4, results5, results6] = await Promise.all([
            paymentsCollection.aggregate([{ $group: { _id: '$payor.accountNumber' } }]).toArray(),
            paymentsCollection.aggregate([{ $group: { _id: '$payor.ABARouting' } }]).toArray(),
            paymentsCollection.aggregate([{ $group: { _id: '$payor.dunkinId' } }]).toArray(),
            paymentsCollection.aggregate([{ $group: { _id: '$payor.EIN' } }]).toArray(),
            paymentsCollection.aggregate([{ $group: { _id: '$employee.dunkinId' } }]).toArray(),
            paymentsCollection.aggregate([{ $group: { _id: '$payee.loanAccountNumber' } }]).toArray()

        ]);

        const logDistinctValues = (results, description) => {
            if (results.length === 0) {
                console.log(`No distinct ${description} found.`);
            } else {
                const distinctValues = results.map(result => result._id);
                console.log(`Distinct ${description}:`, distinctValues.length);
            }
        };

        logDistinctValues(results, 'payor account number');
        logDistinctValues(results2, 'payor ABA routing number');
        logDistinctValues(results3, 'payor dunkin id');
        logDistinctValues(results4, 'payor ein');
        logDistinctValues(results5, 'emp dunkin ids');
        logDistinctValues(results6, 'payee loan num');



    } catch (err) {
        console.error('An error occurred:', err);
    }
});
