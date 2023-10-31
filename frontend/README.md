# Loan Payout Dashboard

Interview project for Method.

## How to Run the Project

### Backend
navigate to `payout-dashboard/backend` and run `npm install` to install dependencies and `npm start` to start the express server.

### Frontend
navigate to `payout-dashboard/frontend` and run `npm install` to install dependencies and `npm start` to start the react frontend.

### Database and Method API
create a config.env file (in the backend directory root) modeled like the following to use MongoDB and the Method API to store and process payments, respectively.
```
ATLAS_URI=mongodb+srv://<username>:<password>@<db name>.flngg84.mongodb.net/?retryWrites=true&w=majority
PORT=5000
METHOD_KEY=<method secret key>
```



### Message Queue
The backend uses RabbitMQ as a message queue. You'll need to have RabbitMQ installed and running locally to process loan payout requests. Run the following command to start a RabbitMQ docker container.
```
 docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:management
```

## Thoughts on the Design and Architecture
- My main concern was using too much memory on the API server to store the contents of the XML file.  To offset this, I decided to enqueue all the payments in a message queue.  This way, we can
dequeue the payments at our desired pace, keeping in mind the Method API rate limits.  This way, the upload of the file from the frontend is fast, but the consumer processes messages at its desired pace.
- I similarly thought of using a cron or background job to offload the payment processing.
- One concern I have is the amount of API requests I'm making to the backend.  Is it better to chunk the XML data on the frontend and send chunks to the queue, or maybe directly upload the file to some cloud store?
- If we're on a client that loses connection, part of the payments will be processed and another part won't be processed.  It would be good to notify the user not to navigate away from the page when the upload is in process.
- It would be good design for the website to keep the user notified of the upload status of the most recent uploaded files.
- When the user is presented with the decision to approve or decline the batch of XML payments, it would be nice if they can edit a row in case they need to change something in particular.
- In the consumer, I decided to keep an in memory cache of accounts, entities, and merchants.  I decided for in memory to reduce repeated calls to the database.  However, if multiple processes are using the same consumer instance, there can be a lot of problems with keeping the caches synced.
- Right now, I'm processing each payment in order, while creating account/entities when needed.  For a larger system, having separate queues for each method api request might be advantageous.  This way when workers are dequeuing from the queue, a pool can possibly process payments in parallel if the accounts/entities for that payment has already been created.  However, this approach would require a shared state amongs all workers to keep track of the current chunk, resources consumed, and the number of requests to the method api
- Another idea would be to offload the XML file to an on-prem/cloud storage to do later processing.  However, we would still be reading the large file in one request which would be a concern for the memory of the instance.
- I'm assuming that the producer and consumer will each be workers/processes on their own.  For the sake of this project, they are running on the express server.

## Questions/Concerns
- I had to use curl on the command line in order to download the XML file in the notion.  It seems to be too large to open in the browser (tends to crash when clicking on it).
- The Dunkin Donuts corp zip code in payment, specifically the one from Iowa, returns the following error when creating the entity.  I had to look up the zip code and manually hard code the state to 'KS'.

    ```
    MethodInvalidRequestError: Invalid zip code for state provided. Verify your request and try again.
        at MethodError.generate (/Users/vishaalganesan/payout-dashboard/backend/node_modules/method-node/dist/index.ts.js:65:16)
        at /Users/vishaalganesan/payout-dashboard/backend/node_modules/method-node/dist/index.ts.js:156:27
        at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
        at async Entity._create (/Users/vishaalganesan/payout-dashboard/backend/node_modules/method-node/dist/index.ts.js:185:13) {
      type: 'INVALID_REQUEST',
      sub_type: 'INVALID_REQUEST',
      code: 400
    ```
- Sometimes a merchant for a plaid id doesn't exist and we’re not able to create a dest acct, is this by design?
- Does it make sense to cache the merchant Ids for each plaid id?  Is the plaid id unique for every merchant Id?
