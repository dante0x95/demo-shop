# Copilot Code Review Instructions

## Purpose

When reviewing pull requests in this repository, focus on code quality and maintainability.

Another reviewer is responsible for functional correctness, tests, requirements, security, runtime behavior, and edge cases.

## Review focus

Review changed code for:

- Readability and ease of understanding.
- Clear and intention-revealing names.
- Simple and easy-to-follow control flow.
- Unnecessary complexity or cleverness.
- Over-engineering and premature abstractions.
- Unnecessary wrappers, helpers, factories, interfaces, or layers.
- Functions or methods with too many unrelated responsibilities.
- Code structure and placement of related logic.
- Consistency with existing patterns in the surrounding codebase.
- Duplication only when it materially harms readability or maintainability.
- Comments that explain unnecessary complexity instead of simplifying the code.

Prefer simple, explicit, boring code over clever or highly abstract code.

Prefer the conventions already used in the repository over subjective style preferences.

Do not suggest abstractions for hypothetical future reuse.

Do not recommend refactors unless they make the current code meaningfully easier to understand or maintain.

If the implementation is already clear and simple, do not invent feedback.

## Out of scope

Do not review or comment on:

- Functional correctness.
- Business logic correctness.
- Product or ticket requirements.
- Test coverage or missing tests.
- Test correctness.
- Runtime behavior.
- Edge cases.
- Security.
- Performance, unless complexity directly harms readability or maintainability.
- Formatting handled by linters, formatters, or automated tooling.

Avoid duplicating feedback that belongs to those areas.

## Review comments

Only leave a comment when there is a concrete, actionable improvement.

Comments should be concise and explain:

- What is unnecessarily difficult to understand or maintain.
- Why it matters.
- A simpler or clearer alternative, when useful.

Avoid:

- Nitpicking.
- Personal style preferences.
- Speculative future-proofing.
- Unnecessary rewrites.
- Repeating the same concern in multiple places.
- Suggesting additional abstractions without a clear current need.

## Guiding principle

Optimize for code that another engineer can understand quickly, modify confidently, and explain without excessive context.

Prefer the simplest implementation that clearly expresses the current requirement.
