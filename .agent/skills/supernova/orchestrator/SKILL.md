---
name: orchestrator
description: "Unified entry point. Analyzes request, determines mode (turbo/standard/audit), routes to appropriate workflow. Replaces context-agent, design-agent, plan-writer, architect-agent."
license: MIT
metadata:
  version: "1.0.2"
  sdlc_aware: true
  replaces: ["context-agent", "design-agent", "plan-writer", "architect-agent"]
  modes: ["turbo", "standard", "audit"]
argument-hint: "[request]"
disable-model-invocation: false
user-invocable: true
context: fork
agent: general-purpose
allowed-tools: Read Glob Grep Bash(git:*) Task
---

# Orchestrator

**Purpose:** Single entry point for all Supernova workflows. Analyzes scope, determines appropriate ceremony level, and routes to specialized agents.

**Token Optimizations:**
- Shared context across phases (no re-scanning)
- Single invocation for think+plan+route
- Mode-appropriate ceremony level

---

## Step 1: SDLC Phase Classification

Every request must first be classified into one of two routing categories:
- **build_loop**: requests involving writing, modifying, or deleting code
- **lifecycle_loop**: requests involving any of the 12 lifecycle phases

### Branching Logic
```
IF build_loop -> continue to Step 2 (mode detection, unchanged)
IF lifecycle_loop -> route to supernova:lifecycle, STOP
```

*Note on ambiguous requests:* Default to build_loop, note phase in context.

### Phase-to-Route Mapping Table
| Phase Name | Sub-Phase Triggers | Route |
|---|---|---|
| framing | validate idea, market fit | supernova:lifecycle |
| strategy | PRD, roadmap, risk | supernova:lifecycle |
| architecture | ADR, system design | supernova:lifecycle |
| ux | wireframe, user flow | supernova:lifecycle |
| api | API contract, REST | supernova:lifecycle |
| database | schema design, ER diagram | supernova:lifecycle |
| infrastructure | VPC, Terraform | supernova:lifecycle |
| security | threat model, SOC2 | supernova:lifecycle |
| testing | unit tests, integration | Step 2 -> builder |
| ci-cd | pipelines, actions | Step 2 -> ship |
| deployment | releasing to prod | Step 2 -> ship |
| post-launch | metrics, retention | supernova:lifecycle |
| go-to-market | pricing, launch plan | supernova:lifecycle |
| scaling | sharding, reliability | supernova:lifecycle |
| governance | technical debt | supernova:lifecycle |

---

## Step 2: Mode Detection (Build Loop Only)

Auto-detect based on scope analysis:

| Mode | Criteria | Token Budget |
|------|----------|--------------|
| **Turbo** | 1-3 files, simple change, no new deps | Minimal |
| **Standard** | 3-10 files, new feature, new patterns | Moderate |
| **Audit** | 10+ files, security-sensitive, architecture change | Full |

### Detection Logic

```
IF files_affected <= 3 AND complexity == "low" AND no_new_deps:
    MODE = turbo
ELSE IF files_affected <= 10 AND complexity == "medium":
    MODE = standard
ELSE:
    MODE = audit
```

### Complexity Assessment
To evaluate the `complexity` variable above:
- **Low**: Minor tweaks, bug fixes in existing logic, simple refactors, documentation updates.
- **Medium**: Adding new endpoint/component logic following existing patterns, moderate data model changes.
- **High**: Architectural shifts, integrating new third-party services, major security implication changes, or establishing new patterns.

---

## Turbo Mode Flow

**For:** Bug fixes, refactors, small additions (1-3 files)

1. **Analyze** (30 seconds)
   - Parse request
   - Identify affected files
   - Check if fits turbo criteria

2. **Skip Design**
   - No design document
   - Brief mental model only

3. **Route Directly**
   - Dispatch to builder with turbo flag
   - Inline execution, no subagents

**Output:** Direct execution, ~70% token savings

---

## Standard Mode Flow

**For:** New features, moderate changes (3-10 files)

1. **Analyze** (1-2 minutes)
   - Parse request
   - Scan existing codebase patterns
   - Identify integration points

2. **Brief Design** (1-2 questions max)
   - One clarifying question if needed
   - 2-3 sentence design summary
   - No formal document

3. **Create Task List**
   - 3-7 bite-sized tasks
   - Each task: 1 file, 5-10 minutes
   - RED-GREEN-REFACTOR per task

4. **Route to Build Agent**
   - Single subagent execution
   - Basic review built-in

**Output:** `docs/.turbo/design.md`, task list, ~40% token savings

---

## Audit Mode Flow

**For:** Complex features, security-critical, architecture changes (10+ files)

1. **Deep Analysis** (2-3 minutes)
   - Full codebase scan
   - Dependency mapping
   - Constraint identification

2. **Socratic Design** (as needed)
   - Explore 2-3 approaches
   - Discuss trade-offs
   - Validate assumptions

3. **Architecture Review**
   - Pattern recommendations
   - Anti-pattern warnings
   - ADR if significant decision

4. **Detailed Planning**
   - 5-15 tasks
   - Exact file paths
   - Test strategy per task

5. **Multi-Agent Pipeline**
   - Sequential subagent execution
   - Dedicated reviewers
   - Security scan

**Output:** `docs/adr/`, detailed plan, full quality gates

---

## Lifecycle Loop Flow

1. **Classify Phase**
   - Classify the specific SDLC phase
2. **Snapshot Context**
   - Pass context snapshot with: sdlc_phase, user goal, codebase context
3. **Route**
   - Route to supernova:lifecycle

*Note: orchestrator does not produce lifecycle deliverables itself*

### Context Packet Snapshot
The following JSON structure is passed to ALL downstream skills at routing:
```json
{
  "sdlc_phase": "...",
  "mode": "...",
  "request_summary": "...",
  "files_affected": [],
  "complexity_signals": {},
  "git_context": "..."
}
```

---

## Quick Reference

### Lifecycle Examples
```
"write a PRD for the auth system"
"should we use microservices or monolith"
"design the database schema for users and orders"
"design the REST API contract for the payments service"
"threat model the authentication flow"
"metric framework for post-launch"
"structure our technical debt management plan"
```

### Turbo Examples
```
"Fix the typo in README"
"Add console.log for debugging"
"Rename variable x to userCount"
"Fix off-by-one error in loop"
```

### Standard Examples
```
"Add email validation to signup"
"Create user profile component"
"Add pagination to list view"
```

### Audit Examples
```
"Implement OAuth authentication"
"Add payment processing"
"Refactor database layer"
"Create plugin system"
```

---

## Integration

**Routes to:**
- `supernova:lifecycle` (lifecycle phase entry)
- `builder` (turbo/standard)
- `guard` (security check)
- Full pipeline (audit mode)

**Invocation Note:**
- Claude Code hooks do not currently support SessionStart events. `orchestrator` must be manually invoked by the user at the start of a session (e.g., using `/nova`) or implicitly triggered by commands relating to orchestration or context gathering.

**Required Context:**
- Current git status
- Existing file patterns
- User's intent

---

## Templates

- **Task list schema:** see `assets/TASK-LIST-TEMPLATE.json` for structured task planning

---

## Rules

1. **Classify SDLC phase first - always before any other analysis**
2. **Route lifecycle requests immediately - do not handle in orchestrator**
3. **Always analyze first** - Never assume mode
4. **Default to turbo** - When in doubt, start minimal
5. **Escalate if needed** - Turbo can become standard mid-flight
6. **One orchestration per request** - Don't nest orchestrators
7. **Preserve context** - Pass accumulated context to next agent

