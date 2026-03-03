# Defense in Depth

After finding and fixing a root cause, add validation at multiple layers to prevent similar issues.

## The Technique

1. **Fix the root cause** - the actual source of the bug
2. **Add input validation** - at the function that first receives external data
3. **Add boundary checks** - at component boundaries (API → service → database)
4. **Add meaningful error messages** - so future bugs are easier to trace

## Example

```javascript
// Layer 1: API input validation
app.get('/user/:id', (req, res) => {
  if (!req.params.id || isNaN(req.params.id)) {
    return res.status(400).json({ error: 'Valid user ID required' });
  }
  // ...
});

// Layer 2: Service boundary
function getUser(id) {
  if (!id) throw new Error('getUser requires a user ID');
  // ...
}

// Layer 3: Database query
function findById(id) {
  const user = db.query('SELECT * FROM users WHERE id = $1', [id]);
  if (!user) return null; // Explicit null, not undefined
  return user;
}
```

## Principle

One layer failing should not cascade. Each layer protects itself.
