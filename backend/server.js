const express = require("express");
const uploadRoute = require('./routes/uploadRoute'); // Adjust the path as necessary
const { Method, Environments } = require('method-node');

const app = express();
const cors = require("cors");
require("dotenv").config({ path: "./config.env" });
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
//app.use(require("./routes/record"));

app.use('/upload', uploadRoute);


// get driver connection
const dbo = require("./conn");
const {startConsumer} = require("./mq/consumer");
const {getDb} = require("./conn");
app.listen(port, async () => {
    await dbo.connectToServer(function (err) {
        if (err) console.error(err);
    });
    //startConsumer()

    const method = new Method({
        apiKey: process.env.METHOD_KEY,
        env: Environments.dev,
    });


    // const entity = method.entities.create({
    //     type: 'c_corporation',
    //     corporation: {
    //         name: 'Dunkin\' Donuts LLC',
    //         dba: 'Dunkin\' Donuts',
    //         ein: '32120240',
    //         owners: [],
    //     },
    //     address: {
    //         line1: '999 Hayes Lights',
    //         line2: null,
    //         city: 'Kerlukemouth',
    //         state: 'IA',
    //         zip: '67485',
    //     },
    // }).then(x => console.log(x));

    // const account = method.accounts.create({
    //     holder_id: 'ent_qLgRTbq8jWqAn',
    //     ach: {
    //         routing: '403911437',
    //         number: '40909581',
    //         type: 'checking',
    //     },
    // }).then(x => console.log(x));

    // const payment = method.payments.create({
    //     amount: 5000,
    //     source: 'acc_VLzzdnqbVXKnG',
    //     destination: 'acc_cWXL3HPQmnFVK',
    //     description: 'Loan Pmt',
    // }).then(x => console.log(x));

    // const entity = method.entities.create({
    //     type: 'individual',
    //     individual: {
    //         first_name: 'Kevin',
    //         last_name: 'Doyle',
    //         phone: '15121231111',
    //         email: 'kevin.doyle@gmail.com',
    //         dob: '1997-03-18',
    //     }
    // }).then(x => console.log(x));

    // const account = method.accounts.create({
    //     holder_id: 'ent_pVeYy4D7bQX7g',
    //     liability: {
    //         mch_id: 'mch_307596',
    //         number: '04807469',
    //     }
    // }).then(x => console.log(x));

    //const merchants = method.merchants.list({"provider_id.plaid": "ins_116248"}).then(x => console.log(x));
    // const merchants1 = method.merchants.list().then(x => console.log(x.length));
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
        const [results, results2, results3, results4, results5] = await Promise.all([
            paymentsCollection.aggregate([{ $group: { _id: '$payor.accountNumber' } }]).toArray(),
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
        logDistinctValues(results2, 'payor dunkin id');
        logDistinctValues(results3, 'payor ein');
        logDistinctValues(results4, 'emp dunkin ids');
        logDistinctValues(results5, 'payee loan num');


    } catch (err) {
        console.error('An error occurred:', err);
    }
});
