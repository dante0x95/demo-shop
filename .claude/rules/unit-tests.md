# Unit tests

When modifying or adding production code, unit tests are part of the Definition of Done
(`.claude/rules/agent-workflow.md`). Files: `src/**/__tests__/*.unit.spec.ts`, run with
`npm run test:unit`.

## Scope in this project
- Unit tests cover logic that runs without a database or server: `utils/`, validators, option
  parsing, pure helpers used by steps and routes. Keep that logic in pure functions so it can be
  unit-tested.
- Behavior that needs Medusa's container (routes, workflows, module services) stays in the
  integration suites. Don't mock the container to force it into a unit test (rule 8).

## Rules
1. Test observable behavior, not the implementation.
2. Derive test cases from the requirements, acceptance criteria, business rules (`Decided:`
   bullets in `docs/PLAN.md`) and the expected API contract.
3. For every changed behavior, include:
   - at least one normal/happy-path case;
   - relevant boundary cases;
   - relevant invalid-input or failure cases;
   - regression cases for bugs being fixed.
4. Give each test a descriptive name that explains the scenario and expected result.
5. Use assertions that verify meaningful outputs, state changes, errors, or externally
   observable interactions.
6. Do not duplicate the production algorithm inside the test to calculate the expected result.
7. Do not test private methods directly unless there is an exceptional documented reason.
8. Avoid excessive mocking. Mock external dependencies or boundaries only when necessary.
9. Keep tests deterministic, isolated, repeatable, and independent of execution order.
10. Do not rely on real network calls, current time, random values, shared mutable state, or
    external services unless explicitly required by the test type.
11. Ensure the new tests fail when the corresponding behavior is intentionally broken.
12. Run the complete relevant unit-test suite and confirm that all tests pass.
13. Maintain or improve the project's agreed code and branch coverage, but do not create
    meaningless tests solely to increase coverage.
14. If mutation testing is available, use it for important new or changed logic and investigate
    surviving meaningful mutations.
15. Do not consider the task complete merely because tests were generated. Review whether each
    test can detect a plausible defect.

## Report before finishing
- which behaviors were tested;
- which edge/error cases were included;
- any behavior that could not be tested and why;
- the test command executed and its result.
