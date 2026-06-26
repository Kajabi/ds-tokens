# Kajabi Design System Tokens

This monorepo contains design tokens and related packages that form the foundation of Kajabi's design system. These packages ensure design consistency across all Kajabi products and provide developers with standardized design primitives.

## About This Repository

This is an Nx-powered monorepo that houses packages related to Kajabi's design system tokens. Using a monorepo architecture allows us to maintain related packages together while keeping their codebases separate.

## Packages

| Project | Package | Version | Downloads | Links |
| ------- | ------- | ------- | --------- | ----- |
| Styles | [@kajabi-ui/styles](https://www.npmjs.com/package/@kajabi-ui/styles) | [![npm version](https://img.shields.io/npm/v/@kajabi-ui/styles.svg)](https://www.npmjs.com/package/@kajabi-ui/styles) | [![NPM Downloads](https://img.shields.io/npm/dm/@kajabi-ui/styles.svg)](https://www.npmjs.com/package/@kajabi-ui/styles) | [README](./packages/styles/README.md) |

## Built with Nx

This repository uses [Nx](https://nx.dev), a set of extensible dev tools for monorepos. Nx provides several benefits:

- Smart rebuilds of affected projects
- Distributed task execution & computation caching
- Powerful code generators & workspace analysis
- Integrated tooling for linting, testing, and building

### Nx Commands

Here are some common Nx commands used in this repository:

```bash
# Build all packages
npx nx run-many --target=build --all

# Build a specific package
npx nx build @kajabi-ui/styles

# Run lint on all packages
npx nx run-many --target=lint --all

# Generate a graph of the project dependencies
npx nx graph
```

## Getting Started

### Prerequisites

- Node.js (see `package.json` for recommended version)
- npm or yarn

### Setup

1. Clone the repository
   ```bash
   git clone https://github.com/kajabi/ds-tokens.git
   cd ds-tokens
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Build all packages
   ```bash
   npx nx run-many --target=build --all
   ```

## Contributing

We welcome contributions from the team. Because `@kajabi-ui/styles` is a contract
that Pine and downstream apps depend on, please read:

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — setup, how to add or change a token,
  regenerating output, branch/commit conventions, and the PR process.
- **[VERSIONING.md](./VERSIONING.md)** — what counts as a breaking change, the
  deprecation policy, and how releases are cut.

Quick notes: changes follow [Conventional Commits](https://www.conventionalcommits.org/)
(the commit type drives the release version), and branch names use a
`type/description` form (`feat/…`, `fix/…`, etc. — `feature/…` is rejected by the
branch-name hook).

## License

See the [LICENSE](LICENSE) file for details.

---

© 2025 Kajabi, LLC. All rights reserved.
