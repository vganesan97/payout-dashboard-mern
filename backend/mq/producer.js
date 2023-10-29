const amqp = require('amqplib/callback_api');

let channel = null;

// Initialize connection and channel
amqp.connect('amqp://localhost:5672', (error0, connection) => {
    if (error0) {
        console.error(error0);
        return;
    }

    connection.createChannel((error1, ch) => {
        if (error1) {
            console.error(error1);
            return;
        }

        ch.assertQueue('paymentQueue', { durable: false });
        channel = ch;
    });
});

function sendToQueue(message) {
    if (channel) {
        try {
            channel.sendToQueue('paymentQueue', Buffer.from(message));
            console.log(`[Producer] Sent ${message.length}`);
        } catch (error) {
            console.error(`[Producer] Failed to send message: ${error}`);
        }
    } else {
        console.error('[Producer] Channel not initialized.');
    }
}


module.exports = { sendToQueue };
