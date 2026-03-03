---
name: subagent-engine
description: "Use when executing implementation plans with independent tasks in the current session. Dispatches fresh subagent per task with two-stage review. Triggers - build, subagent, execute tasks, implement plan in session."
license: MIT
metadata:
  version: "1.0.2"
  sdlc_phases: ["implementation"]
  priority: "7"
argument-hint: "[plan-file-path]"
disable-model-invocation: false
user-invocable: true
context: fork
agent: general-purpose
allowed-tools: Read Glob Grep Bash(git:*) Write Edit Task
---

# SubagentEngine - Subagent-Driven Development

Execute plan by dispatching **fresh subagent per task**, with **two-stage review** after each: spec compliance first, then code quality.

**Core principle:** Fresh subagent per task + two-stage review (spec then quality) = high quality, fast iteration.

**Announce at start:** "I'm using the subagent-engine skill to execute this plan."

---

## When to Use

**Use this when:**
- Have an implementation plan with independent tasks
- Want to stay in the current session
- Tasks are mostly independent (not tightly coupled)

**Use `plan-executor` instead when:**
- Want batch execution in a separate session
- Tasks are tightly coupled and need sequential context

---

## The Process

### Step 1: Extract All Tasks

1. Read plan file once
2. Extract all tasks with **full text and context**
3. Note any cross-task dependencies
4. Create TodoWrite with all tasks

### Step 2: Per Task Loop

For each task:

**2a. Dispatch Implementer Subagent**
- Use `./implementer-prompt.md` template
- Provide full task text + project context
- Subagent implements, tests, commits, and self-reviews

**2b. Handle Questions**
- If subagent asks questions: answer clearly and completely
- Provide additional context if needed
- Don't rush them into implementation

**2c. Dispatch Spec Reviewer Subagent**
- Use `./spec-reviewer-prompt.md` template
- Reviewer checks: does code match the spec exactly?
- If issues found → implementer fixes → re-review
- Repeat until spec compliant

**2d. Dispatch Code Quality Reviewer Subagent**
- Use `./code-quality-reviewer-prompt.md` template
- Reviewer checks: is the implementation well-built?
- If issues found → implementer fixes → re-review
- Repeat until approved

**2e. Mark Task Complete**

### Step 3: Final Review

After all tasks complete:
- Dispatch final code-reviewer subagent for entire implementation
- Verify all tests pass
- **REQUIRED SUB-SKILL:** Use `supernova:ship`

---

## Prompt Templates

- `./implementer-prompt.md` - Dispatch implementer subagent
- `./spec-reviewer-prompt.md` - Dispatch spec compliance reviewer
- `./code-quality-reviewer-prompt.md` - Dispatch code quality reviewer

---

## Red Flags

**Never:**
- Start implementation on main/master branch without explicit user consent
- Skip reviews (spec compliance OR code quality)
- Proceed with unfixed issues
- Dispatch multiple implementation subagents in parallel (conflicts)
- Make subagent read plan file (provide full text instead)
- Skip scene-setting context
- Ignore subagent questions
- Accept "close enough" on spec compliance
- **Start code quality review before spec compliance is **
- Move to next task while either review has open issues

**If subagent asks questions:**
- Answer clearly and completely
- Provide additional context if needed
- Don't rush them into implementation

**If reviewer finds issues:**
- Implementer (same subagent) fixes them
- Reviewer reviews again
- Repeat until approved

**If subagent fails task:**
- Dispatch fix subagent with specific instructions
- Don't try to fix manually (context pollution)

---

## Integration

**Required workflow skills:**
- **supernova:ship** - REQUIRED: Set up isolated workspace and complete development
- **supernova:plan-writer** - Creates the plan this skill executes

**Subagents should use:**
- **supernova:builder** - Subagents follow integrated TDD for each task
