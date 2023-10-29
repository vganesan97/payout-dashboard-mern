const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config({ path: "./config.env" });

const Db = process.env.ATLAS_URI;

const client = new MongoClient(Db, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

var _db;

module.exports = {
    connectToServer: async function (callback) {
        try {
            await client.connect();
            _db = client.db("payout-dashboard"); // <-- Make sure to set _db here
            await client.db("admin").command({ ping: 1 });
            console.log("Successfully connected to MongoDB.");
            callback(null);
        } catch (err) {
            console.error("Error connecting to MongoDB:", err);
            callback(err);
        } finally {
            // Don't close the client if you intend to use it later
            // await client.close();
        }
    },

    getDb: function () {
        return _db;
    },
};
