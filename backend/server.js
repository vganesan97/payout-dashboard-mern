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

    const method = new Method({
        apiKey: process.env.METHOD_KEY,
        env: Environments.dev,
    });
    method.ping().then(r => console.log("method connection:", r))

    const webhook = await method.webhooks.create({
        type: 'payment.update',
        url: 'https://localhost:5000/paymentStatusWebhook',
    });
    console.log(`Webhook for payment status updates created: ${webhook}`);

    startConsumer()
    console.log("Consumer started.")

    console.log(`Server is running on port: ${port}`);
});
