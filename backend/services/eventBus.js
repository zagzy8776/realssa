const EventEmitter = require('events');

class RealSSAEventBus extends EventEmitter {
  constructor() {
    super();
    // Allow up to 50 concurrent domain listeners
    this.setMaxListeners(50);
  }

  /**
   * Safe emit wrapper with automatic error catching
   */
  dispatch(eventName, payload) {
    try {
      console.log(`[EventBus] ⚡ Emitting event: [${eventName}]`);
      this.emit(eventName, {
        ...payload,
        dispatched_at: new Date().toISOString()
      });
    } catch (err) {
      console.error(`❌ [EventBus Error] Failed to dispatch event [${eventName}]:`, err.message);
    }
  }
}

const eventBus = new RealSSAEventBus();
module.exports = eventBus;
