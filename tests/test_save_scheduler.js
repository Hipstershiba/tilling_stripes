// tests/test_save_scheduler.js
// Tests the pure createSaveScheduler utility with fake/deterministic timers.

const path = require('path');
const targetPath = process.env.TEST_TARGET_DIR
  ? path.resolve(process.env.TEST_TARGET_DIR, 'core/state_persistence.js')
  : path.resolve(__dirname, '../core/state_persistence.js');

const StatePersistence = require(targetPath);

console.log('--- Testing Save Scheduler (Debounce & Flush) ---');
console.log('Testing target:', targetPath);

if (typeof StatePersistence.createSaveScheduler !== 'function') {
  throw new TypeError(`createSaveScheduler is not a function (got ${typeof StatePersistence.createSaveScheduler})`);
}

// Simple deterministic fake timer implementation
function createFakeTimers() {
  let currentTime = 0;
  let nextId = 1;
  const timers = new Map();

  return {
    setTimeout(fn, delay) {
      const id = nextId++;
      timers.set(id, { fn, triggerTime: currentTime + delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advanceTime(ms) {
      currentTime += ms;
      const toRun = [];
      for (const [id, timer] of timers.entries()) {
        if (timer.triggerTime <= currentTime) {
          toRun.push({ id, fn: timer.fn });
        }
      }
      for (const { id, fn } of toRun) {
        timers.delete(id);
        fn();
      }
    },
    getPendingCount() {
      return timers.size;
    }
  };
}

// 1. 50 rapid calls to schedule() before delay -> save called exactly 1x
{
  const fakeTimers = createFakeTimers();
  let saveCount = 0;
  const scheduler = StatePersistence.createSaveScheduler({
    save: () => { saveCount++; },
    delayMs: 300,
    timers: fakeTimers
  });

  for (let i = 0; i < 50; i++) {
    scheduler.schedule();
  }

  if (saveCount !== 0) {
    throw new Error(`Expected 0 saves before delay, got ${saveCount}`);
  }
  if (!scheduler.pending()) {
    throw new Error('Expected scheduler.pending() === true while timer is running');
  }

  fakeTimers.advanceTime(299);
  if (saveCount !== 0) {
    throw new Error(`Expected 0 saves at 299ms, got ${saveCount}`);
  }

  fakeTimers.advanceTime(1); // Reaches 300ms
  if (saveCount !== 1) {
    throw new Error(`Expected exactly 1 save at 300ms, got ${saveCount}`);
  }
  if (scheduler.pending()) {
    throw new Error('Expected scheduler.pending() === false after timer triggers');
  }
  console.log('✓ 50 rapid schedule() calls collapsed to exactly 1 save.');
}

// 2. flush() with pending request -> 1 immediate save, pending() === false, returns true
{
  const fakeTimers = createFakeTimers();
  let saveCount = 0;
  const scheduler = StatePersistence.createSaveScheduler({
    save: () => { saveCount++; },
    delayMs: 300,
    timers: fakeTimers
  });

  scheduler.schedule();
  scheduler.schedule();
  if (!scheduler.pending()) throw new Error('Expected pending() === true');

  const flushed = scheduler.flush();
  if (flushed !== true) {
    throw new Error(`Expected flush() to return true, got ${flushed}`);
  }
  if (saveCount !== 1) {
    throw new Error(`Expected exactly 1 save on flush, got ${saveCount}`);
  }
  if (scheduler.pending()) {
    throw new Error('Expected pending() === false after flush');
  }

  // Advancing time afterwards should not trigger any additional save
  fakeTimers.advanceTime(500);
  if (saveCount !== 1) {
    throw new Error(`Expected save count to stay 1 after delay, got ${saveCount}`);
  }
  console.log('✓ flush() with pending request triggers immediate save and resets pending.');
}

// 3. flush() with nothing pending -> 0 saves and returns false
{
  const fakeTimers = createFakeTimers();
  let saveCount = 0;
  const scheduler = StatePersistence.createSaveScheduler({
    save: () => { saveCount++; },
    delayMs: 300,
    timers: fakeTimers
  });

  const flushed = scheduler.flush();
  if (flushed !== false) {
    throw new Error(`Expected flush() on empty scheduler to return false, got ${flushed}`);
  }
  if (saveCount !== 0) {
    throw new Error(`Expected 0 saves, got ${saveCount}`);
  }
  console.log('✓ flush() with nothing pending returns false without saving.');
}

// 4. Two bursts separated by flush() -> 2 saves, not 1
{
  const fakeTimers = createFakeTimers();
  let saveCount = 0;
  const scheduler = StatePersistence.createSaveScheduler({
    save: () => { saveCount++; },
    delayMs: 300,
    timers: fakeTimers
  });

  // First burst
  scheduler.schedule();
  scheduler.schedule();
  scheduler.flush(); // Save 1
  if (saveCount !== 1) throw new Error(`Expected 1 save after first flush, got ${saveCount}`);

  // Second burst
  scheduler.schedule();
  scheduler.schedule();
  fakeTimers.advanceTime(300); // Save 2
  if (saveCount !== 2) throw new Error(`Expected 2 saves after second burst, got ${saveCount}`);

  console.log('✓ Two bursts separated by flush() executed exactly 2 saves.');
}

// 5. cancel() removes pending timer without saving
{
  const fakeTimers = createFakeTimers();
  let saveCount = 0;
  const scheduler = StatePersistence.createSaveScheduler({
    save: () => { saveCount++; },
    delayMs: 300,
    timers: fakeTimers
  });

  scheduler.schedule();
  scheduler.cancel();
  if (scheduler.pending()) throw new Error('Expected pending() === false after cancel()');

  fakeTimers.advanceTime(500);
  if (saveCount !== 0) throw new Error(`Expected 0 saves after cancel, got ${saveCount}`);
  console.log('✓ cancel() successfully aborted pending save.');
}

console.log('--- ALL SAVE SCHEDULER CHECKS PASSED PERFECTLY! ---');
