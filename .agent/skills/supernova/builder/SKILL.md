---
name: builder
description: "Executes implementation with TDD and review built-in. Handles turbo (inline), standard (single subagent), and audit (multi-agent) execution."
license: MIT
metadata:
  version: "1.0.2"
  sdlc_phases: ["testing", "implementation"]
  replaces: ["subagent-engine", "tdd-enforcer", "code-review-agent", "verification-gate"]
  modes: ["turbo", "standard", "audit"]
argument-hint: "[task-or-plan]"
disable-model-invocation: false
user-invocable: true
context: fork
agent: general-purpose
allowed-tools: Read Glob Grep Bash(git:*) Write Edit Task
---

# Builder

**Purpose:** Execute implementation with integrated TDD and review. Mode-aware execution from inline (turbo) to multi-agent (audit).

---

## Turbo Execution (Inline)

**For:** Single tasks, 1-3 files

### Process

1. **RED** - Write failing test
   ```python
   def test_feature():
       result = function(input)
       assert result == expected
   ```

2. **GREEN** - Minimal implementation
   ```python
   def function(input):
       return expected  # simplest possible
   ```

3. **REFACTOR** - Clean code
   - Remove duplication
   - Improve naming
   - Add edge cases

4. **VERIFY** - Run tests
   ```bash
   npm test  # or pytest, cargo test, etc.
   ```

5. **INLINE REVIEW** - Self-check
   - [ ] Tests pass
   - [ ] No hardcoded secrets
   - [ ] Follows patterns
   - [ ] Error handling

**No subagent dispatch** - Execute directly

---

## Standard Execution (Single Subagent)

**For:** Multiple tasks, moderate complexity

### Per Task Loop

```
FOR each task in plan:
    1. Dispatch subagent with task context
    2. Subagent executes TDD cycle
    3. Subagent runs self-review
    4. Return results
    5. Verify tests pass
    6. Mark complete
END
```

### Subagent Prompt Template

```markdown
## Task: [description]

**Files:**
- Create: `[path]`
- Test: `[test-path]`

**Requirements:**
- [specific requirement 1]
- [specific requirement 2]

**TDD Cycle:**
1. Write failing test
2. Minimal implementation
3. Refactor
4. Verify

**Patterns to Follow:**
- [existing pattern 1]
- [existing pattern 2]

**Return when:**
- Tests pass
- Review complete
- Ready for next task
```

---

## Audit Execution (Multi-Agent)

**For:** Complex features, security-critical

### Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Implementer │ → │ Reviewer    │ → │ Verifier    │
│ (writes)    │    │ (checks)    │    │ (confirms)  │
└─────────────┘    └─────────────┘    └─────────────┘
      ↑                    │                  │
      └────────────────────┴──────────────────┘
              (loop until approved)
```

### Review Checklist

**Spec Compliance:**
- [ ] Implements all requirements
- [ ] Edge cases handled
- [ ] Error cases covered
- [ ] Tests verify behavior

**Code Quality:**
- [ ] SOLID principles
- [ ] DRY - no duplication
- [ ] Clear naming
- [ ] Appropriate abstractions

**Security:**
- [ ] No secrets in code
- [ ] No injection vectors
- [ ] Input validated
- [ ] Safe defaults

---

## TDD Integration (Built-in)

### RED Phase
```python
# Write test first
def test_user_can_signup():
    user = signup(email="test@example.com", password="secret123")
    assert user.email == "test@example.com"
    assert user.id is not None
```

### GREEN Phase
```python
# Minimal implementation
def signup(email, password):
    user = User(email=email)
    db.save(user)
    return user
```

### REFACTOR Phase
```python
# Clean up
from security import hash_password

def signup(email: str, password: str) -> User:
    if not is_valid_email(email):
        raise ValueError("Invalid email")

    if user_exists(email):
        raise ConflictError("User exists")

    user = User(
        email=email,
        password_hash=hash_password(password)
    )
    db.save(user)
    return user
```

### VERIFY Phase
```bash
$ pytest test_signup.py -v

test_signup.py::test_user_can_signup PASSED
test_signup.py::test_duplicate_email_rejected PASSED
test_signup.py::test_invalid_email_rejected PASSED

3 passed in 0.02s
```

---

## Verification Built-in

### Before Claiming Complete

**Tests:**
- Run full test suite
- Check: 0 failures
- Check: Coverage maintained

**Lint:**
- Run linter
- Check: 0 errors
- Check: 0 warnings (optional)

**Security:**
- Scan for secrets
- Check: No hardcoded keys
- Check: No SQL injection

**Git:**
- Stage changes
- Commit with message
- Verify: Clean working tree

---

## Mode Comparison

| Aspect | Turbo | Standard | Audit |
|--------|-------|----------|-------|
| Execution | Inline | 1 subagent | Multi-agent |
| TDD | Self | Subagent | Enforced |
| Review | Self | Built-in | Dedicated |
| Security | Hooks | Hooks + Scan | Deep audit |
| Tokens | -70% | Baseline | +50% |
| Time | Fast | Moderate | Thorough |

---

## Integration

**Called by:**
- `orchestrator` (all modes)

**Calls:**
- `guard` (security scan)
- `ship` (completion)

**Required Input:**
- Task description
- Mode (turbo/standard/audit)
- File paths
- Patterns to follow

---

## Rules

1. **TDD always** - Test first, always
2. **Verify before claim** - Evidence required
3. **Mode-appropriate** - Don't over-engineer turbo
4. **Fail fast** - Stop on test failure
5. **Commit per task** - Small, focused commits
