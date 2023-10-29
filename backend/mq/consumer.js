const amqp = require('amqplib/callback_api');

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

            console.log(`[Consumer] Waiting for messages in ${queue}\n`);

            channel.consume(
                queue,
                (message) => {
                    const content = message.content.toString();
                    console.log(`[Consumer] Received ${content.length}`);
                    console.log()
                    // Process the payment here.

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
