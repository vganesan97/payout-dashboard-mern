const express = require('express');
const multer = require('multer');
const xml2js = require('xml2js');
require("dotenv").config({ path: "./config.env" });
const { Method, Environments } = require('method-node');
const formatter = require('xml-formatter');
const {sendToQueue} = require("../mq/producer");
const {getDb} = require("../conn");

const method = new Method({
    apiKey: process.env.METHOD_KEY,
    env: Environments.dev,
});


const router = express.Router();

let buffer = "";
const sourceEntityMap = {};
const destEntityMap =  {}
const sourceAcctMap = {};
const destAcctMap = {};
let processedPayments = 0;
let errorsEncountered = 0;


const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('file'), (req, res) => {
    let chunk = req.file.buffer.toString('utf-8');
    chunk = buffer + chunk;

    const rows = chunk.split('</row>');
    buffer = rows.pop(); // Incomplete row, if any, will be kept in buffer

    let index = 0;  // Initialize index to keep track of current row

    const interval = setInterval(() => {
        if (index >= rows.length) {
            clearInterval(interval); // Stop when all rows have been processed
            console.log(`Total payments processed: ${processedPayments}`);
            console.log(`Total errors encountered: ${errorsEncountered}`);
            res.status(200).send('All chunks processed');
            return;
        }

        let row = rows[index];
        row += '</row>';
        processRow(row).then(() => {
            processedPayments++;
        }).catch(() => {
            errorsEncountered++;
        });

        index++;
    }, 1000);
});

async function processRow(row) {
    return new Promise(async (resolve, reject) => {
        const removeRootTag = (xmlString) => {
            const removedOpeningTag = xmlString.replace(/^<root>/, '');
            const removedBothTags = removedOpeningTag.replace(/<\/root>$/, '');
            return removedBothTags;
        };
        const x = removeRootTag(row)

        xml2js.parseString(x, async function (err, result) {
            if (err) {
                console.error("Error parsing XML:", err);
                return;
            }

            // Access fields using the result object
            const empDunkinId = result.row.Employee[0].DunkinId[0];
            const empDunkinBranch = result.row.Employee[0].DunkinBranch[0];
            const empFirstName = result.row.Employee[0].FirstName[0];
            const empLastName = result.row.Employee[0].LastName[0];
            const empDOB = result.row.Employee[0].DOB[0];
            const empPhoneNumber = result.row.Employee[0].PhoneNumber[0];

            const payorDunkinId = result.row.Payor[0].DunkinId[0];
            const payorABARouting = result.row.Payor[0].ABARouting[0];
            const payorAccountNumber = result.row.Payor[0].AccountNumber[0];
            const payorName = result.row.Payor[0].Name[0];
            const payorDBA = result.row.Payor[0].DBA[0];
            const payorEIN = result.row.Payor[0].EIN[0];
            const payorAddressLine1 = result.row.Payor[0].Address[0].Line1[0]
            const payorAddressCity = result.row.Payor[0].Address[0].City[0]
            const payorAddressState = result.row.Payor[0].Address[0].State[0]
            const payorAddressZip = result.row.Payor[0].Address[0].Zip[0]

            const payeePlaidId = result.row.Payee[0].PlaidId[0];
            const payeeLoadAccNum = result.row.Payee[0].LoanAccountNumber[0];

            const amount = result.row.Amount[0];

            const db = getDb();

            // Create a new document
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
                        state: payorAddressState,
                        zip: payorAddressZip
                    }
                },
                payee: {
                    plaidId: payeePlaidId,
                    loanAccountNumber: payeeLoadAccNum
                },
                amount: amount
            };

            if (!sourceEntityMap[payorEIN]) {
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

            if (!destEntityMap[empDunkinId]) {
                function convertDateFormat(dateString) {
                    const [month, day, year] = dateString.split('-');
                    return `${year}-${month}-${day}`;
                }

                const entity = await method.entities.create({
                    type: 'individual',
                    individual: {
                        first_name: empFirstName,
                        last_name: empLastName,
                        phone: '15121231111',
                        email: 'kevin.doyle@gmail.com',
                        dob: convertDateFormat(empDOB),
                    }
                })
                destEntityMap[empDunkinId] = entity.id;
            }

            if (!sourceAcctMap[payorAccountNumber]) {
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
                const merchants = await method.merchants.list({"provider_id.plaid": payeePlaidId});
                if (merchants.length === 0) {
                    console.log("No merchants found for Plaid ID:", payeePlaidId);
                    return;  // Skip this row and move to the next one
                }
                const mchId = merchants[0].mch_id;
                // The rest of your code to create accounts and payments

                // Perform account creation and other operations
                if (!destAcctMap[payeeLoadAccNum]) {
                    const account = await method.accounts.create({
                        holder_id: destEntityMap[empDunkinId],
                        liability: {
                            mch_id: mchId,
                            account_number: payeeLoadAccNum
                        }
                    });
                    destAcctMap[payeeLoadAccNum] = account.id;
                }

                // Convert amount to cents and create payment
                function convertToCents(amountString) {
                    const amountFloat = parseFloat(amountString.replace('$', ''));
                    const amountInCents = Math.round(amountFloat * 100);
                    return amountInCents;
                }

                const payment = await method.payments.create({
                    amount: convertToCents(amount),
                    source: sourceAcctMap[payorAccountNumber],
                    destination: destAcctMap[payeeLoadAccNum],
                    description: 'Loan Pmt',
                });
                console.log(payment)
                resolve()
            } catch (error) {
                console.log('Error:', error.message);
                reject()
                // Skip this row and move to the next one
            }


            // // Choose the appropriate collection
            // const paymentsCollection = db.collection('payments');
            //
            // // Insert the document into the collection
            // await paymentsCollection.insertOne(paymentDocument);
            // console.log("Payment document inserted");
            //
            // // Format the row for logging or sending to the queue
            // const prettyRow = formatter(row, {
            //     indentation: '  ', // Indentation using 2 spaces
            // });
            //
            // // Send it to the queue
            // //sendToQueue(prettyRow);

        });
    })
}

module.exports = router;
