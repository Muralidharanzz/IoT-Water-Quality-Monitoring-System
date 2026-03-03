# Condition-Based Waiting

Replace arbitrary `sleep()` / `setTimeout()` with condition polling.

## The Problem

```javascript
// BAD - arbitrary timeout, flaky
await sleep(2000);
expect(element).toBeVisible();
```

Why this fails:
- Too short on slow machines → flaky tests
- Too long on fast machines → slow tests
- No feedback about what you're waiting for

## The Solution

```javascript
// GOOD - wait for the actual condition
await waitFor(() => expect(element).toBeVisible(), { timeout: 5000 });
```

## Patterns

### Polling a condition
```javascript
async function waitForCondition(check, { timeout = 5000, interval = 100 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await check()) return;
    await sleep(interval);
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}
```

### Waiting for an event
```javascript
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Timeout')), 5000);
  emitter.once('ready', () => { clearTimeout(timer); resolve(); });
});
```

## When to Use

- Test setup (waiting for server to start)
- UI tests (waiting for element to appear)
- Integration tests (waiting for async operation)
- Any place you see `sleep()` or `setTimeout()` used for synchronization
