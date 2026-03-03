---
name: modify
description: "Safe delete, rename, and bulk update operations. Dry-run first, confirm, then execute with rollback support."
license: MIT
metadata:
  version: "1.0.2"
  sdlc_phases: ["governance", "implementation"]
  operations: ["delete", "rename", "bulk-update", "refactor"]
argument-hint: "[operation] [target]"
disable-model-invocation: false
user-invocable: true
context: fork
agent: general-purpose
allowed-tools: Read Glob Grep Bash(git:*) Write Edit
---

# Modify Agent

**Purpose:** Safe codebase modifications with impact analysis, dry-run preview, confirmation gates, and automatic rollback.

**Problem:** AI agents can accidentally delete critical files, break imports, or leave codebase in broken state.

**Solution:** Dry-run → Preview → Confirm → Execute → Verify

---

## Delete Operation

### Workflow

```
1. ANALYZE   → Find all references to file
2. DRY-RUN   → Show what would break
3. CONFIRM   → User approval required
4. BACKUP    → Git stash before delete
5. EXECUTE   → Delete with cleanup
6. VERIFY    → Check nothing broke
```

### Step 1: Analyze Impact

```bash
# Find all imports/references
grep -r "from.*module_name" --include="*.py"
grep -r "import.*module_name" --include="*.py"
grep -r "require.*module_name" --include="*.js"

# Find in configuration
grep -r "module_name" config/ --include="*.json"
grep -r "module_name" --include="*.yml" --include="*.yaml"
```

### Step 2: Dry-Run Preview

```
┌─────────────────────────────────────────┐
│ DELETE IMPACT ANALYSIS                  │
├─────────────────────────────────────────┤
│ File to delete: src/utils/helpers.py    │
│                                         │
│ References found:                       │
│   - src/auth/login.py:12 (import)       │
│   - src/api/users.py:8 (import)         │
│   - tests/test_helpers.py (test file)   │
│                                         │
│ Impact: HIGH (3 references)             │
│                                         │
│ Suggested actions:                      │
│   1. Remove imports from login.py       │
│   2. Remove imports from users.py       │
│   3. Delete test file                   │
└─────────────────────────────────────────┘
```

### Step 3: Confirmation Gate

```
⚠️  Destructive Operation Detected

Delete: src/utils/helpers.py
Impact: 3 files reference this
Backup: Created (git stash)

Proceed? [y/N/show-impact/abort]
```

### Step 4: Safe Execution

```bash
# Stash current state
git stash push -m "modify: pre-delete backup"

# Remove references first
# (edit files to remove imports)

# Delete the file
rm src/utils/helpers.py

# Verify no broken references
grep -r "from.*helpers" --include="*.py" || echo "Clean"
```

### Step 5: Verification

```bash
# Run tests
npm test  # or pytest, etc.

# Check for import errors
python -c "import src.auth.login"  # Should fail gracefully or work

# If tests fail → automatic rollback
git stash pop
```

---

## Rename Operation

### Workflow

```
1. ANALYZE   → Find all references
2. PREVIEW   → Show rename mapping
3. CONFIRM   → User approval
4. BACKUP    → Git stash
5. EXECUTE   → Rename + update references
6. VERIFY    → Tests pass
```

### Example: Rename Function

```python
# BEFORE
# src/utils.py
def get_user_data(id):  # → get_user
    ...

# src/auth.py
from utils import get_user_data

# AFTER
# src/utils.py
def get_user(id):
    ...

# src/auth.py
from utils import get_user
```

### Dry-Run Output

```
┌─────────────────────────────────────────┐
│ RENAME PREVIEW                          │
├─────────────────────────────────────────┤
│ Function: get_user_data → get_user      │
│                                         │
│ Files to modify:                        │
│   ✓ src/utils.py (definition)           │
│   ✓ src/auth.py (import + 2 calls)      │
│   ✓ src/api.py (1 call)                 │
│   ✓ tests/test_utils.py (3 tests)       │
│                                         │
│ Total changes: 5 files, 7 locations     │
└─────────────────────────────────────────┘
```

### Safe Execution

```bash
# Stash backup
git stash push -m "modify: pre-rename backup"

# Rename with sed (dry-run first)
sed -i 's/get_user_data/get_user/g' src/utils.py src/auth.py src/api.py tests/test_utils.py

# Verify with tests
npm test

# If fail → rollback
git stash pop
```

---

## Bulk Update Operation

### Workflow

```
1. PATTERN   → Define search/replace
2. PREVIEW   → Show affected files
3. DRY-RUN   → Show diffs
4. CONFIRM   → User approval
5. EXECUTE   → Batch update
6. VERIFY    → Tests + review
```

### Use Cases

- Update API version strings
- Rename constants
- Migrate deprecated functions
- Update import paths

### Example: Update API Version

```bash
# Pattern
Search:  API_VERSION = "v1"
Replace: API_VERSION = "v2"

# Scope
Files: src/**/*.py
Exclude: */migrations/*, */vendor/*
```

### Preview

```
┌─────────────────────────────────────────┐
│ BULK UPDATE PREVIEW                     │
├─────────────────────────────────────────┤
│ Pattern: API_VERSION = "v1" → "v2"        │
│                                         │
│ Files matched: 12                       │
│ Excluded: 3                             │
│                                         │
│ Sample changes:                         │
│   src/config.py:5                       │
│   - API_VERSION = "v1"                  │
│   + API_VERSION = "v2"                  │
│                                         │
│   src/client.py:12                      │
│   - API_VERSION = "v1"                  │
│   + API_VERSION = "v2"                  │
│                                         │
│ [Show all 12 files] [Confirm] [Cancel]│
└─────────────────────────────────────────┘
```

### Safe Execution

```bash
# Create branch
git checkout -b modify/bulk-update-api-version

# Apply changes
find src -name "*.py" -exec sed -i 's/API_VERSION = "v1"/API_VERSION = "v2"/g' {} \;

# Verify
git diff --stat
npm test

# If tests pass → commit
# If tests fail → revert
git checkout -- .
```

---

## Refactor Operation

### Workflow

```
1. IDENTIFY  → Find code to refactor
2. ANALYZE   → Impact assessment
3. PLAN      → Step-by-step refactor
4. CONFIRM   → User approval
5. EXECUTE   → Incremental changes
6. VERIFY    → Tests at each step
```

### Example: Extract Function

```python
# BEFORE
def process_order(order):
    # Validate order
    if not order.items:
        raise ValueError("Empty order")
    if order.total <= 0:
        raise ValueError("Invalid total")

    # Calculate tax
    tax = order.total * 0.08

    # Save order
    db.save(order)
    return order

# AFTER
def validate_order(order):
    if not order.items:
        raise ValueError("Empty order")
    if order.total <= 0:
        raise ValueError("Invalid total")

def calculate_tax(amount):
    return amount * 0.08

def process_order(order):
    validate_order(order)
    tax = calculate_tax(order.total)
    db.save(order)
    return order
```

### Refactor Preview

```
┌─────────────────────────────────────────┐
│ REFACTOR PLAN                           │
├─────────────────────────────────────────┤
│ Operation: Extract Function             │
│ Target: process_order                   │
│                                         │
│ Steps:                                  │
│   1. Create validate_order()            │
│   2. Create calculate_tax()             │
│   3. Update process_order()             │
│   4. Update tests                       │
│                                         │
│ Impact: 1 file, 3 new functions         │
│ Tests: 4 existing tests                 │
└─────────────────────────────────────────┘
```

---

## Safety Features

### Automatic Backup

```bash
# Before any destructive operation
git stash push -m "modify: auto-backup"

# Store stash hash for rollback
STASH_HASH=$(git stash list | head -1 | cut -d: -f1)
echo "Backup created: $STASH_HASH"
```

### Rollback

```bash
# On failure
modify_rollback() {
    echo "Rolling back changes..."
    git checkout -- .
    git stash pop
    echo "Rolled back to pre-operation state"
}
```

### Impact Analysis

```python
def analyze_impact(file_path):
    references = []

    # Find imports
    for root, _, files in os.walk('src'):
        for file in files:
            if file.endswith('.py'):
                with open(os.path.join(root, file)) as f:
                    content = f.read()
                    if f"from {module}" in content or f"import {module}" in content:
                        references.append(file)

    return {
        'file': file_path,
        'references': references,
        'impact_level': 'HIGH' if len(references) > 5 else 'MEDIUM' if len(references) > 0 else 'LOW'
    }
```

---

## Commands

### Delete
```
/nova modify delete src/old-module.py
/nova modify delete --dry-run src/old-module.py
/nova modify delete --force src/old-module.py
```

### Rename
```
/nova modify rename get_user_data get_user
/nova modify rename --scope=src/ old_name new_name
```

### Bulk Update
```
/nova modify bulk "API_VERSION = \"v1\"" "API_VERSION = \"v2\""
/nova modify bulk --include="*.py" --exclude="*/test/*" search replace
```

### Refactor
```
/nova modify refactor extract-function process_order validate_order
/nova modify refactor extract-class UserService
```

---

## Integration

**Called by:**
- User command `/nova modify`
- Other agents needing safe modifications

**Calls:**
- `guard` (security scan)
- `builder` (verify after changes)

---

## Rules

1. **Dry-run first** - Always preview before execute
2. **Confirm destructive ops** - Never delete without confirmation
3. **Backup automatically** - Git stash before changes
4. **Verify after** - Tests must pass
5. **Rollback on failure** - Automatic recovery
6. **Log everything** - Audit trail of all modifications
