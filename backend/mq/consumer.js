const amqp = require('amqplib/callback_api');
const {getDb} = require("../conn");
const redis = require('redis');
const {Method, Environments} = require("method-node");

const sourceEntityMap = {};
const destEntityMap =  {}
const sourceAcctMap = {};
const destAcctMap = {};
const plaidIdToMerchantId = {};

const method = new Method({
    apiKey: process.env.METHOD_KEY,
    env: Environments.dev,
});

const client = redis.createClient({host: 'localhost', port: 6379});

let clientConnected = false;

async function connectRedisClient() {
    if (!clientConnected) {
        await client.connect();
        clientConnected = true;
    }
}

async function incrementAndCheckLimit() {
    const currentTime = new Date();
    const currentSecond = currentTime.getSeconds();
    const currentMinute = currentTime.getMinutes();
    const key = `rate_limit:${currentMinute}:${currentSecond}`;

    try {
        await connectRedisClient();
        const transaction = client.multi();
        transaction.incr(key);
        transaction.expire(key, 60);
        const replies = await transaction.exec();
        const requestsThisSecond = replies[0];
        if (requestsThisSecond > 10) await new Promise((resolve) => setTimeout(resolve, 1000 - currentTime.getMilliseconds()));
        return true;
    } catch (err) {
        console.error('Error in incrementAndCheckLimit:', err);
        throw err;
    }
}

async function processRow(row, fileId) {
    const empDunkinId = row.Employee.DunkinId;
    const empDunkinBranch = row.Employee.DunkinBranch;
    const empFirstName = row.Employee.FirstName;
    const empLastName = row.Employee.LastName;
    const empDOB = row.Employee.DOB;
    const empPhoneNumber = row.Employee.PhoneNumber;
    const payorDunkinId = row.Payor.DunkinId;
    const payorABARouting = row.Payor.ABARouting;
    const payorAccountNumber = row.Payor.AccountNumber;
    const payorName = row.Payor.Name;
    const payorDBA = row.Payor.DBA;
    const payorEIN = row.Payor.EIN;
    const payorAddressLine1 = row.Payor.Address.Line1;
    const payorAddressCity = row.Payor.Address.City;
    const payorAddressState = row.Payor.Address.State;
    const payorAddressZip = row.Payor.Address.Zip;
    const payeePlaidId = row.Payee.PlaidId;
    const payeeLoadAccNum = row.Payee.LoanAccountNumber;
    const amount = row.Amount;

    const db = getDb();
    const paymentsCollection = db.collection('payments');
    if (!sourceEntityMap[payorEIN] && await incrementAndCheckLimit()) {
        const entity = await method.entities.create({
            type: 'c_corporation',
            corporation: {
                name: payorName,
                dba: payorDBA,
                ein: payorEIN,
                owners: [],
            },
            address: {
                line1: payorAddressLine1,
                line2: null,
                city: payorAddressCity,
                state: 'KS',
                zip: payorAddressZip,
            },
        })
        sourceEntityMap[payorEIN] = entity.id;
    }

    if (!destEntityMap[empDunkinId] && await incrementAndCheckLimit()) {
        const entity = await method.entities.create({
            type: 'individual',
            individual: {
                first_name: empFirstName,
                last_name: empLastName,
                phone: '15121231111'
            }
        })
        destEntityMap[empDunkinId] = entity.id;
    }

    if (!sourceAcctMap[payorAccountNumber] && await incrementAndCheckLimit()) {
        const account = await method.accounts.create({
            holder_id: sourceEntityMap[payorEIN],
            ach: {
                routing: payorABARouting,
                number: payorAccountNumber,
                type: 'checking',
            },
        })
        sourceAcctMap[payorAccountNumber] = account.id;
    }

    try {
        if (payeePlaidId && plaidIdToMerchantId[payeePlaidId] === -1) return;
        if (payeePlaidId && !plaidIdToMerchantId[payeePlaidId] && await incrementAndCheckLimit()) {
            const merchants = await method.merchants.list({"provider_id.plaid": payeePlaidId});
            if (merchants.length === 0) {
                console.log("No merchants found for Plaid ID:", payeePlaidId);
                plaidIdToMerchantId[payeePlaidId] = -1
                return;
            }
            plaidIdToMerchantId[payeePlaidId] = merchants[0].mch_id;
        }

        if (!destAcctMap[payeeLoadAccNum] && await incrementAndCheckLimit()) {
            const account = await method.accounts.create({
                holder_id: destEntityMap[empDunkinId],
                liability: {
                    mch_id: plaidIdToMerchantId[payeePlaidId],
                    account_number: payeeLoadAccNum
                }
            });
            destAcctMap[payeeLoadAccNum] = account.id;
        }

        function convertToCents(amountString) {
            const amountFloat = parseFloat(amountString.replace('$', ''));
            const amountInCents = Math.round(amountFloat * 100);
            return amountInCents;
        }

        if (await incrementAndCheckLimit()) {
            const payment = await method.payments.create({
                amount: convertToCents(amount),
                source: sourceAcctMap[payorAccountNumber],
                destination: destAcctMap[payeeLoadAccNum],
                description: 'Loan Pmt',
            });

            const paymentDocument = {
                employee: {
                    dunkinId: empDunkinId,
                    dunkinBranch: empDunkinBranch,
                    firstName: empFirstName,
                    lastName: empLastName,
                    DOB: empDOB,
                    phoneNumber: empPhoneNumber
                },
                payor: {
                    dunkinId: payorDunkinId,
                    ABARouting: payorABARouting,
                    accountNumber: payorAccountNumber,
                    name: payorName,
                    DBA: payorDBA,
                    EIN: payorEIN,
                    address: {
                        line1: payorAddressLine1,
                        city: payorAddressCity,
                        state: 'KS',
                        zip: payorAddressZip
                    }
                },
                payee: {
                    plaidId: payeePlaidId,
                    loanAccountNumber: payeeLoadAccNum
                },
                amount: amount,
                methodPayment: payment,
                fileId: fileId
            };
            try {
                await paymentsCollection.insertOne(paymentDocument);
                console.log(`Successfully inserted payment document with Method payment info for MongoDB`);
                console.log(payment.id)
            } catch (error) {
                console.error('Database insertion error:', error);
            }
        }
    } catch (error) {
        console.error(error);
    }
}

function startConsumer() {
    amqp.connect('amqp://localhost:5672', (error0, connection) => {
        if (error0) {
            console.error(error0);
            return;
        }

        connection.createChannel((error1, channel) => {
            if (error1) {
                console.error(error1);
                return;
            }

            const queue = 'paymentQueue';

            channel.assertExchange('paymentExchange');
            channel.bindQueue(queue, 'paymentExchange', queue);

            channel.assertQueue(queue, {
                durable: false,
            });

            channel.prefetch(1);  // <-- This line limits how many unacknowledged messages can be sent to the consumer.

            console.log(`[Consumer] Waiting for messages in ${queue}\n`);

            channel.consume(
                queue,
                async (message) => {
                    const content = message.content.toString();
                    const paymentJson = JSON.parse(content)
                    console.log(`[Consumer] Received ${paymentJson.fileInfo.fileNum}`);
                    await processRow(paymentJson, paymentJson.fileId);
                    if (paymentJson.fileInfo.fileNum === paymentJson.fileInfo.numOfPayments) {
                        const db = getDb();
                        const xmlCollection = db.collection('xml-files');
                        const xmlDocument = {
                            fileId: paymentJson.fileInfo.id,
                            fileName: paymentJson.fileInfo.fileName,
                            numOfPayments: paymentJson.fileInfo.numOfPayments,
                            dateCreated: new Date(),
                        };
                        try {
                            await xmlCollection.insertOne(xmlDocument);
                        } catch (error) {
                            console.error('Database insertion error:', error);
                        }
                    }
                    channel.ack(message);
                },
                {
                    noAck: false,
                }
            );

        });
    });
}

module.exports = { startConsumer };
