// kafkaConsumer.js
const { Kafka } = require('kafkajs');
require('dotenv').config();

const kafka = new Kafka({
  brokers: [process.env.KAFKA_BROKERS],
});

const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP });

async function startConsumer(onGameMessage) {
  await consumer.connect();
  await consumer.subscribe({ topic: process.env.KAFKA_TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const data = JSON.parse(message.value.toString());
        console.log('Kafka message received:', data);
        onGameMessage(data); // Call server with { userId, game }
      } catch (err) {
        console.error('Invalid Kafka message format:', err);
      }
    },
  });
}

module.exports = startConsumer;
