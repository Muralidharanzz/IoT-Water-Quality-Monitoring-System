# Root Cause Tracing

Trace bugs backward from symptom to source.

## The Technique

When an error occurs deep in a call stack:

1. **Start at the error** - where does the bad value appear?
2. **Trace one level up** - what called this function with the bad value?
3. **Keep going** - where did THAT function get the value?
4. **Find the source** - the first place the value goes wrong

## Fix at the Source

- Don't add guards at the symptom location
- Fix where the value first becomes incorrect
- Add validation at component boundaries (see `defense-in-depth.md`)

## Example

```
Error: Cannot read property 'name' of undefined
  at displayUser(user.js:42)        ← symptom
  ← fetchUser(api.js:18)            ← returns undefined on 404
  ← loadProfile(profile.js:7)       ← doesn't check for undefined
  ← handleRoute(router.js:23)       ← passes userId that doesn't exist
```

**Fix at source:** `handleRoute` should validate userId exists before calling `loadProfile`.
