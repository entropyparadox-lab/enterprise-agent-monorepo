# Contributing to enterprise-agent-monorepo

Thank you for your interest in contributing to `enterprise-agent-monorepo`! We welcome pull requests, bug reports, and suggestions.

---

## 1. Development Workflow

1. **Fork & Clone** the repository:
   ```bash
   git clone https://github.com/entropyparadox-lab/enterprise-agent-monorepo.git
   cd enterprise-agent-monorepo
   ```

2. **Install Dependencies**:
   ```bash
   pnpm install
   ```

3. **Start Development Environment**:
   ```bash
   make dev
   ```

4. **Verify Type-Safety & Tests Before Submitting**:
   ```bash
   # Run full 4-stage verification suite
   make test
   ```

---

## 2. Commit Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

* `feat(scope)`: New features or API endpoints
* `fix(scope)`: Bug fixes
* `docs(scope)`: Documentation additions or updates
* `refactor(scope)`: Code changes that neither fix a bug nor add a feature
* `test(scope)`: Adding or correcting tests

---

## 3. Pull Request Guidelines

* Keep PRs focused on a single change.
* When adding or modifying backend models/endpoints in `apps/api`, run `make codegen` to sync `packages/api-client`.
* Ensure CI passes cleanly with 0 type errors and all integration tests passing.
