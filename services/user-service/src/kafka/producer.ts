import { Kafka, Producer, logLevel } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'user-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  logLevel: logLevel.ERROR,
  retry: {
    initialRetryTime: 300,
    retries: 10,
  },
});

let producer: Producer;

export async function initProducer(): Promise<void> {
  producer = kafka.producer({
    allowAutoTopicCreation: true,
    transactionTimeout: 30000,
  });

  const maxRetries = 10;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await producer.connect();
      console.log('[User Service] Kafka producer connected');
      return;
    } catch (error) {
      attempt++;
      console.warn(`[User Service] Kafka connection attempt ${attempt}/${maxRetries} failed. Retrying in 3s...`);
      if (attempt >= maxRetries) {
        throw new Error(`Failed to connect to Kafka after ${maxRetries} attempts`);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

export async function publishEvent(topic: string, payload: object): Promise<void> {
  if (!producer) {
    throw new Error('Kafka producer not initialized. Call initProducer() first.');
  }

  await producer.send({
    topic,
    messages: [
      {
        key: String((payload as Record<string, unknown>).userId || Date.now()),
        value: JSON.stringify(payload),
        timestamp: String(Date.now()),
      },
    ],
  });
}

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
  }
}
