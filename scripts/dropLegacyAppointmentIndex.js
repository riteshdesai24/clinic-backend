require('dotenv').config();
const mongoose = require('mongoose');

const indexName = 'doctorId_1_appointmentDate_1';

async function run() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');

  await mongoose.connect(process.env.MONGO_URI);
  const indexes = await mongoose.connection.collection('appointments').indexes();
  const legacyIndex = indexes.find(index => index.name === indexName);

  if (!legacyIndex) {
    console.log(`Legacy appointment index ${indexName} does not exist; no changes made.`);
    return;
  }

  const keys = Object.entries(legacyIndex.key || {});
  const isExpectedIndex = legacyIndex.unique === true
    && keys.length === 2
    && keys[0][0] === 'doctorId'
    && keys[0][1] === 1
    && keys[1][0] === 'appointmentDate'
    && keys[1][1] === 1;

  if (!isExpectedIndex) {
    throw new Error(`Refusing to drop ${indexName}: its definition does not match the expected legacy unique index`);
  }

  await mongoose.connection.collection('appointments').dropIndex(indexName);
  console.log(`Dropped stale unique index ${indexName}.`);
}

run()
  .catch(error => {
    console.error('Appointment index migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
