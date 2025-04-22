# Kajabi Design System Tokens and Styles (@kajabi-ui/styles)

A comprehensive design tokens package that provides standardized design primitives for Kajabi's design system. This package (@kajabi-ui/styles) serves as the foundation for consistent UI development across all Kajabi products.


## Purpose

This repository houses Kajabi's design system tokens, which serve as the single source of truth for colors, typography, spacing, and other design primitives used across Kajabi's products. These tokens ensure design consistency, streamline development, and create a unified visual experience.

Key features:
- Centralized design tokens management
- Platform-agnostic implementation
- Compatible with multiple formats (CSS, SCSS, JSON)
- Built with [Style Dictionary](https://amzn.github.io/style-dictionary) and [Tokens Studio](https://tokens.studio/)
- Easy integration with CDN options

## Installation

### NPM Package

```bash
npm install @kajabi-ui/styles
```

or

```bash
yarn add @kajabi-ui/styles
```

### Usage in Projects

#### CSS Import

```css
@use '~@kajabi-ui/styles/pine/pine.css';
```

#### SCSS Import

```scss
@use '~@kajabi-ui/styles/pine/pine.scss';
```

#### JavaScript Import

```javascript
import '@kajabi-ui/styles/pine/pine.css';
```

### CDN Usage with jsDelivr

You can also use jsDelivr to include our design tokens directly in your HTML without installing the package:

```html
<!-- Global CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kajabi-ui/styles/dist/pine/pine.css">
```

The CDN option is ideal for:
- Quick prototyping
- Projects that don't use a build system
- Third-party integrations with Kajabi

### Specific Component Usage

For more granular imports of specific components:

```css
/* Import only chip tokens */
@use '@kajabi-ui/styles/pine/components/pds-chip/pds-chip.tokens.scss';
```

## Available Token Categories

- Colors and themes
- Typography (font families, sizes, weights)
- Spacing and layout
- Border properties (width, radius)
- Shadows and elevation
- Z-index
- Motion and animations
- Component-specific tokens (button, chip, etc.)

## Project Structure

```
ds-tokens/
├── packages/
│   └── styles/            # Main package (@kajabi-ui/styles)
│       ├── src/
│       │   ├── tokens/    # Source token files (JSON format)
│       │   └── lib/       # Build and transformation scripts
└── .github/              # GitHub workflows and configuration
```

## Development with Nx

This project is built with [Nx](https://nx.dev/), a smart, extensible build framework. Nx helps manage monorepos and provides efficient build tools for multiple packages.

### Using Nx Commands

#### Building the Project

```bash
# Build the styles package
npx nx run @kajabi-ui/styles:build

# Or using the shorter syntax
npx nx build @kajabi-ui/styles
```

#### Running Other Scripts

```bash
# Generate tokens
npx nx run @kajabi-ui/styles:generate

# Run linting
npx nx run @kajabi-ui/styles:lint
```

#### Nx Targets

To see all available targets for the styles package:

```bash
npx nx show project @kajabi-ui/styles
```


### Using Token Studio

This project uses [Tokens Studio](https://tokens.studio/) (formerly Figma Tokens) to manage design tokens. Token Studio provides a bridge between design and development by allowing designers to maintain tokens in Figma that can be exported and used in the development workflow.

#### Getting Started with Token Studio:

1. **For Designers**:
   - Install the [Tokens Studio for Figma](https://www.figma.com/community/plugin/843461159747178978/tokens-studio-for-figma) plugin
   - Connect to our shared token repository
   - Make changes through the Token Studio interface

2. **For Developers**:
   - Token changes are synchronized with our repository through the build process
   - Token files are stored in the `src/tokens/` directory
   - Review and implement token changes using the standard contribution workflow

### Contribution Workflow

1. Create a feature branch
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes to the token files in `src/tokens/`

3. Run the token generation script
   ```bash
   npm run generate
   ```

4. Verify changes work as expected

5. Commit your changes with a descriptive message
   ```bash
   git commit -m "Add new color tokens for marketing pages"
   ```

6. Push your changes and create a pull request
   ```bash
   git push origin feature/your-feature-name
   ```

7. Request a review from the design systems team

## Release Process

The package is published to NPM with a structure that makes tokens accessible without the `dist/` prefix in import paths, ensuring a clean and intuitive developer experience.

---

© 2025 Kajabi, LLC. All rights reserved.
