const express = require('express');
const multer = require('multer');
const xml2js = require('xml2js');
require("dotenv").config({ path: "./config.env" });
const { Method, Environments } = require('method-node');
const formatter = require('xml-formatter');
const {sendToQueue} = require("../mq/producer");
const {getDb} = require("../conn");
const uuid = require('uuid');


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

router.post('/', upload.single('file'), async (req, res) => {
    const totalMessages = parseInt(req.headers['total-file-size']);  // Get the total file size from header
    const fileId = req.headers['file-id'];  // Get the file ID from header
    const fileName = req.headers['file-name'];  // Get the file name from header
    const chunkStart = parseInt(req.headers['chunk-start']);  // Get the chunk start from header
    const chunkEnd = parseInt(req.headers['chunk-end']);  // Get the chunk end from header

    //console.log(req.body)
    const rows = req.body // If the rows are sent as a JSON array in the request body

    const processRowsWithoutPromise = (rows, fileId) => {
        rows.forEach((row, index) => {
            // setTimeout(() => {
            //     processRow(JSON.parse(JSON.stringify(row)), fileId);
            // }, index * 100000);
            sendToQueue(JSON.stringify(row))
        });
    };


    // Call the function
    processRowsWithoutPromise(rows, fileId);

    // res.status(200).send(`Chunk from ${chunkStart} to ${chunkEnd} processed`);
    res.status(200).send(`All payments sent to queue`);

    // Create a promise for each row's processing

    // console.log(chunkEnd, totalMessages, chunkEnd > totalMessages)
    // if (chunkEnd >= totalMessages) {
    //     //console.log(`Total payments processed: ${processedPayments}`);
    //     //console.log(`Total errors encountered: ${errorsEncountered}`);
    //
    //     const db = getDb();
    //     const xmlCollection = db.collection('xml-files');
    //
    //     const xmlDocument = {
    //         fileId: fileId,
    //         fileName: fileName,
    //         fileSize: totalMessages,
    //         dateCreated: new Date(),
    //     };
    //
    //     try {
    //         await xmlCollection.insertOne(xmlDocument);
    //         console.log("xml updated");
    //         res.status(200).send('All chunks processed');
    //     } catch (error) {
    //         console.error('Database insertion error:', error);
    //         res.status(500).send('Server error');
    //     }
    // } else {
    //     try {
    //         // Wait for all row processing promises to resolve
    //         const processRowsWithoutPromise = (rows, fileId) => {
    //             rows.forEach((row, index) => {
    //                 // setTimeout(() => {
    //                 //     processRow(JSON.parse(JSON.stringify(row)), fileId);
    //                 // }, index * 100000);
    //                 sendToQueue(row)
    //             });
    //         };
    //
    //
    //         // Call the function
    //         processRowsWithoutPromise(rows, fileId);
    //
    //         res.status(200).send(`Chunk from ${chunkStart} to ${chunkEnd} processed`);
    //     } catch (error) {
    //         // If there's an error in processing any row, catch it and increment errors encountered
    //         errorsEncountered++;
    //         console.error('Error in Promise.all:', error);
    //         res.status(500).send('Server error during row processing');
    //     }
    // }
});

async function processRow(row, fileId) {
            console.log("process row")
            // Access fields directly from the row object
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
                console.log("corp entity", entity)
                sourceEntityMap[payorEIN] = entity.id;
            }

           // console.log(destEntityMap)
            if (!destEntityMap[empDunkinId]) {

                const entity2 = await method.entities.create({
                        type: 'individual',
                        individual: {
                            first_name: empFirstName,
                            last_name: empLastName,
                            phone: '15121231111'
                        }
                    })
                    //console.log("individual entity", entity2)
                    destEntityMap[empDunkinId] = entity2.id;

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
                        amount: amount,
                        methodPayment: payment,
                        fileId: fileId
                    };

                    const insertResult = await paymentsCollection.insertOne(paymentDocument);
                    console.log(`Successfully inserted payment document with Method payment info for MongoDB`);


            } catch (error) {
                console.error(error);
            }
            // Resolve the promise once processing is done
              // Return to exit function

}



module.exports = router;
