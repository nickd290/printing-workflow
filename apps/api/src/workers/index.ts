// Workers disabled - running jobs synchronously without Redis
// To enable workers, install Redis and update lib/queue.ts to use BullMQ

console.log('ℹ️  Running in synchronous mode (no Redis/BullMQ)');
console.log('ℹ️  Jobs will execute immediately instead of being queued');
console.log('ℹ️  To enable background workers, install Redis and Docker');

// No workers to export
export const workers = [];
