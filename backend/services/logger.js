const { execute } = require('./sqliteMultiEngine');

class RealSSALogger {
  static async logServiceExecution(serviceName, status, latencyMs, errorMessage = null) {
    console.log(`[Logger] 📊 ${serviceName} -> ${status} (${latencyMs}ms)${errorMessage ? ` | Error: ${errorMessage}` : ''}`);
    try {
      await execute('analytics', `
        INSERT INTO service_execution_log (service_name, status, latency_ms, error_message)
        VALUES (?, ?, ?, ?)
      `, [serviceName, status, latencyMs, errorMessage]);
    } catch (err) {
      console.error('❌ [Logger Failure]:', err.message);
    }
  }

  static async logApiUsage(provider, endpoint, tokensUsed = 0, cost = 0.0) {
    try {
      await execute('analytics', `
        INSERT INTO api_budget_log (provider, endpoint, tokens_used, estimated_cost)
        VALUES (?, ?, ?, ?)
      `, [provider, endpoint, tokensUsed, cost]);
    } catch (err) {
      console.error('❌ [Budget Logger Failure]:', err.message);
    }
  }
}

module.exports = RealSSALogger;
