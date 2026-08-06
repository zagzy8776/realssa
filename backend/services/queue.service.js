const { execute, runQuery } = require('./sqliteMultiEngine');
const eventBus = require('./eventBus');
const RealSSALogger = require('./logger');

class QueueService {
  constructor() {
    this.isProcessing = false;
    // Process queue every 2 seconds
    this.interval = setInterval(() => this.processQueue(), 2000);
  }

  async enqueue(eventName, payload) {
    try {
      await execute('queue', `
        INSERT INTO job_queue (event_name, payload, status)
        VALUES (?, ?, 'pending')
      `, [eventName, JSON.stringify(payload)]);
    } catch (err) {
      console.error('❌ [QueueService] Failed to enqueue job:', err.message);
    }
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingJobs = await runQuery('queue', `
        SELECT * FROM job_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 5
      `);

      if (pendingJobs && pendingJobs.length > 0) {
        for (const job of pendingJobs) {
          const startTime = Date.now();
          try {
            const payload = JSON.parse(job.payload);
            eventBus.dispatch(job.event_name, payload);

            await execute('queue', `
              UPDATE job_queue SET status = 'completed' WHERE id = ?
            `, [job.id]);

            const latency = Date.now() - startTime;
            await RealSSALogger.logServiceExecution(`QueueJob_${job.event_name}`, 'COMPLETED', latency);
          } catch (jobErr) {
            console.error(`❌ [QueueWorker] Job ${job.id} failed:`, jobErr.message);
            await execute('queue', `
              UPDATE job_queue SET status = 'failed', attempts = attempts + 1 WHERE id = ?
            `, [job.id]);
          }
        }
      }
    } catch (err) {
      console.error('❌ [QueueWorker Error]:', err.message);
    } finally {
      this.isProcessing = false;
    }
  }
}

const queueService = new QueueService();
module.exports = queueService;
