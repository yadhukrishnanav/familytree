# Contributing to Family Tree

Thanks for your interest in contributing! 🎉

## Getting Started

1. **Fork** the repo on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/yadhukrishnanav/family-tree.git
   cd family-tree
   ```
3. **Install** dependencies:
   ```bash
   bun install   # or: npm install
   ```
4. **Set up** Supabase (optional — see README for details) or run in demo mode
5. **Run** the dev server:
   ```bash
   bun run dev
   ```

## Development Workflow

1. **Create a branch** for your feature/fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Make your changes** — keep commits focused and descriptive
3. **Lint** before committing:
   ```bash
   bun run lint
   ```
4. **Commit** with a clear message:
   ```bash
   git commit -m "Add feature: short description"
   ```
5. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Open a Pull Request** on GitHub

## Code Style

- **TypeScript** throughout — no `any` unless absolutely necessary
- **Tailwind CSS** for styling — use shadcn/ui components when available
- **Functional components** with hooks
- **Pure reducers** for state — no side effects in the reducer body
- **Comments** for complex logic (layout algorithm, sync diffing, etc.)

## Commit Message Conventions

We use a simple convention:

- `Add feature: ...` — new features
- `Fix: ...` — bug fixes
- `Refactor: ...` — code restructuring
- `Docs: ...` — documentation only
- `Chore: ...` — build, deps, config

## Reporting Bugs

Open a [GitHub issue](https://github.com/yadhukrishnanav/family-tree/issues/new) with:

1. **What happened** (steps to reproduce)
2. **What you expected**
3. **Screenshots** (if applicable)
4. **Browser/OS** you're using

## Suggesting Features

Open a [GitHub issue](https://github.com/yadhukrishnanav/family-tree/issues/new) with the `enhancement` label. Describe:

1. **The problem** you're trying to solve
2. **Your proposed solution**
3. **Alternatives** you've considered

## Areas That Need Help

- 🌍 **Internationalization** — currently English-only; would love i18n support
- 📅 **Full birth dates** — extend `birthYear` to `birthDate` for accurate birthday reminders
- 📤 **GEDCOM support** — import/export industry-standard genealogy format
- 🎨 **Themes** — light/dark mode toggle
- 🧪 **Tests** — currently no test coverage; would love unit + e2e tests

## Questions?

Open a issue or start a [GitHub Discussion](https://github.com/yadhukrishnanav/family-tree/discussions).

---

Thanks for contributing! 💚
