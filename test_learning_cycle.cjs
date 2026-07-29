const { runLearningCycle } = require('./backend/services/humanBrainBot');
const { getBrainStats } = require('./backend/services/brainStore');

async function run() {
  try {
    await runLearningCycle();
    const stats = await getBrainStats();
    console.log('Brain store stats after cycle:', stats);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
