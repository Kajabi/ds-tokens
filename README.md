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

We welcome contributions from the team! Here's how to get started:

### Contribution Workflow

1. **Fork & Clone**: Fork the repository on GitHub, then clone your fork locally.
   ```bash
   # Fork the repo on GitHub first, then:
   git clone https://github.com/YOUR-USERNAME/ds-tokens.git
   cd ds-tokens
   ```

2. **Create a Branch**: Create a new branch for your feature or bug fix.
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**: Implement your changes following our coding standards.

4. **Lint Code**: Ensure your changes meet our code quality standards.
   ```bash
   npx nx affected --target=lint
   ```

5. **Commit Changes**: We follow [Conventional Commits](https://www.conventionalcommits.org/) standards for commit messages.
   ```bash
   git commit -m "feat: add new color token system"
   git commit -m "fix: resolve color token inconsistency"
   git commit -m "docs: update token documentation"
   ```

   Common types include: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, and `chore`.

6. **Push Changes**: Push your branch to GitHub.
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create Pull Request**: Open a PR against the main branch and request reviews.

### Development Guidelines

- Follow the existing code style and conventions
- Add tests for new features
- Update documentation when necessary
- Make sure all tests pass before submitting a PR

## License

See the [LICENSE](LICENSE) file for details.

---

© 2025 Kajabi, LLC. All rights reserved.
