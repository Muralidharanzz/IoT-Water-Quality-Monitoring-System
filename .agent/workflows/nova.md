---
description: "Unified entry point for all Supernova operations. Supports turbo, standard, and audit modes with automatic detection."
---

# /nova Command

**Purpose:** Single entry point for all Supernova workflows.

## Usage

```bash
/nova [mode] [operation] [args]
```

## Modes

| Mode | When | Speed | Quality |
|------|------|-------|---------|
| `turbo` | 1-3 files, simple | Fastest | Good |
| `standard` | 3-10 files, feature | Moderate | Better |
| `audit` | 10+ files, complex | Thorough | Best |
| `lifecycle` | Strategy, planning, architecture, post-launch | Contextual | Authoritative |
| `auto` | Let Supernova decide | Adaptive | Balanced |

## Subcommands

### Main Workflow

```bash
/nova turbo "fix the login button"
/nova standard "add user profile page"
/nova audit "implement OAuth"
```

### Specialized Operations

```bash
/nova review              # Code review
/nova guard               # Security scan
/nova debug               # Systematic debugging
/nova modify [operation]  # Safe modifications
/nova ship                # Verify and finish
```

### SDLC Operations

```bash
/nova plan                # Sprint planning & tickets
/nova system              # Architecture & system design
/nova context             # Onboarding & codebase analysis
/nova infra               # DevOps & infrastructure config
```

## Examples

### Turbo Mode (Fast)

```bash
# Fix a typo
/nova turbo "fix typo in README"

# Quick refactor
/nova turbo "rename x to userCount"

# Add logging
/nova turbo "add console.log to debug login"
```

**What happens:**
1. No design phase
2. Inline execution
3. Self-review
4. Auto-commit

**Time:** 1-5 minutes
**Tokens:** ~70% savings

### Standard Mode (Balanced)

```bash
# Add a feature
/nova standard "add email validation"

# Create component
/nova standard "create UserCard component"

# Add API endpoint
/nova standard "add /api/users endpoint"
```

**What happens:**
1. Brief context gathering
2. One clarifying question if needed
3. Task breakdown
4. Single subagent execution
5. Built-in review

**Time:** 10-30 minutes
**Tokens:** Baseline

### Audit Mode (Thorough)

```bash
# Security feature
/nova audit "implement OAuth authentication"

# Core architecture
/nova audit "refactor database layer"

# Payment system
/nova audit "add Stripe integration"
```

**What happens:**
1. Deep analysis
2. Socratic design exploration
3. ADR document
4. Detailed task plan
5. Multi-agent review
6. Security audit
7. Architecture review

**Time:** 1-2 hours
**Tokens:** +50% (but catches issues early)

## Lifecycle Subcommand

Routes to `supernova:lifecycle` for all SDLC phases outside the build loop.

### Usage

/nova lifecycle "validate my product idea against the market"
/nova lifecycle prd "write a PRD for the auth system"
/nova lifecycle adr "should we use microservices or monolith"
/nova lifecycle schema "design the database schema for users and orders"
/nova lifecycle api "design the REST API contract for the payments service"
/nova lifecycle security "threat model the authentication flow"
/nova lifecycle postlaunch "define our metrics framework"
/nova lifecycle scaling "plan for 10x current load"
/nova lifecycle gtm "create our go-to-market strategy for launch"
/nova lifecycle governance "structure our technical debt management plan"

### Phase Flags

--phase framing        Force Problem Framing & Ideation phase (1)
--phase strategy       Force Product Strategy & Planning phase (2)
--phase architecture   Force Architecture & System Design phase (3)
--phase ux             Force UX & Frontend System Design phase (4)
--phase api            Force API Design & Backend Engineering phase (5)
--phase database       Force Database Design & Configuration phase (6)
--phase infra          Force Infrastructure & Environment Setup phase (7)
--phase security       Force Security Engineering phase (8)
--phase testing        Force Testing Strategy phase (9)
--phase cicd           Force CI/CD Pipeline phase (10)
--phase deployment     Force Deployment & Release Management phase (11)
--phase gtm            Force Go-To-Market Strategy phase (12)
--phase postlaunch     Force Post-Launch Operations phase (13)
--phase scaling        Force Scaling Phase phase (14)
--phase governance     Force Governance & Maintenance phase (15)

## Auto Mode

```bash
/nova "add user login"
```

Supernova automatically selects mode based on:
- Number of files affected
- Complexity indicators
- Security keywords

## Review Subcommand

```bash
/nova review              # Review current changes
/nova review --full       # Full team review
/nova review --security   # Security focus
/nova review --architecture # Architecture review
```

## Guard Subcommand

```bash
/nova guard               # Scan current files
/nova guard --deep        # Deep security audit
/nova guard --secrets     # Secret scan only
/nova guard --llm         # LLM injection check
```

## SDLC Subcommands

```bash
/nova plan                # Generate plan/tickets
/nova system              # Design architecture/DB
/nova context             # Explain codebase execution
/nova infra               # Configure Docker/CI pipelines
```

## Debug Subcommand

```bash
/nova debug               # Debug current issue
/nova debug "error message"
/nova debug --test        # Debug failing test
```

## Modify Subcommand

```bash
/nova modify delete src/old.py
/nova modify rename oldFunc newFunc
/nova modify bulk "v1" "v2"
/nova modify refactor extract-function
```

## Ship Subcommand

```bash
/nova ship                # Verify + commit + finish
/nova ship --commit       # Just commit
/nova ship --pr           # Create PR
/nova ship --merge        # Merge to main
/nova ship --cleanup      # Cleanup only
```

## Options

```bash
--phase [name]     Force a specific SDLC lifecycle phase
--no-code          Route to lifecycle skill regardless of request type
--sdlc             Show current SDLC phase classification for a request (dry-run routing)
--dry-run          # Preview without executing
--verbose          # Detailed output
--quiet            # Minimal output
--force            # Skip confirmations
--keep-branch      # Don't delete branch after ship
--no-tests         # Skip test verification (dangerous)
--no-security      # Skip security scan (dangerous)
```

## Integration

**With Git:**
- Auto-detects branch
- Creates worktrees for isolation
- Handles commit/merge/PR

**With CI:**
- Respects CI environment
- Non-interactive mode
- Exit codes for automation

## Examples by Use Case

### SDLC Strategy and Planning
/nova lifecycle prd "define the MVP for our SaaS product"
/nova lifecycle adr "monolith vs microservices for our scale"
/nova lifecycle schema "users, subscriptions, and billing tables"
/nova lifecycle security "threat model the payment flow"
/nova lifecycle testing "create a load testing plan for launch"
/nova lifecycle cicd "design our deployment pipelines"
/nova lifecycle deployment "plan our blue-green release strategy"
/nova lifecycle postlaunch "activation and retention metrics"

### Bug Fix
```bash
/nova turbo "fix off-by-one in pagination"
```

### Feature
```bash
/nova standard "add dark mode toggle"
```

### Security
```bash
/nova audit "implement rate limiting"
```

### Refactor
```bash
/nova standard "extract UserService from UserController"
```

### Cleanup
```bash
/nova modify delete src/legacy/
/nova ship --cleanup
```
