# Unplayable Documentation

This directory contains the documentation website for the Unplayable library, built with React, Vite, and TypeScript.

## 🚀 Quick Start

### Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev
# Opens at http://localhost:3002

# Build for production
pnpm run build

# Preview production build
pnpm run preview
```

### Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test --coverage

# Run tests in watch mode
pnpm test --watch
```

## 📁 Structure

```
docs/
├── public/                     # Static assets and markdown files
│   ├── getting-started.md     # Getting started guide
│   ├── api-reference.md       # Complete API documentation
│   ├── configuration.md       # Configuration options
│   ├── integration-examples.md # Integration examples
│   ├── audio-formats.md       # Audio formats and devices
│   ├── error-handling.md      # Error handling guide
│   ├── development.md         # Development guide
│   ├── unplayable-icon.svg    # Main icon
│   └── *.png                  # Section-specific icons
├── src/
│   ├── components/            # React components
│   │   ├── LoadingSpinner.tsx
│   │   ├── ErrorMessage.tsx
│   │   └── MarkdownRenderer.tsx
│   ├── App.tsx               # Main application component
│   ├── App.css              # Application styles
│   ├── index.css             # Global styles
│   └── main.tsx              # Application entry point
├── dist/                     # Built files (generated)
└── package.json              # Dependencies and scripts
```

## 🎨 Customization

### Adding New Documentation Sections

1. **Create the markdown file** in `public/`:
   ```bash
   touch public/new-section.md
   ```

2. **Add to the navigation** in `src/App.tsx`:
   ```typescript
   const DOC_SECTIONS: DocSection[] = [
     // ... existing sections
     {
       id: 'new-section',
       title: 'New Section',
       file: 'new-section.md',
       description: 'Description of the new section'
     }
   ];
   ```

3. **Optional: Add custom logo** in `getLogoPath()` function:
   ```typescript
   const getLogoPath = (sectionId: string): string => {
     switch (sectionId) {
       case 'new-section':
         return '/unplayable/new-section-icon.png';
       // ... other cases
     }
   }
   ```

### Styling

- **Colors**: Modify CSS variables in `src/App.css`
- **Typography**: Update font families and sizes in the same file
- **Layout**: Adjust responsive breakpoints and spacing

### Icons and Assets

- Place icons in `public/` directory
- Use SVG format for scalable icons
- Follow naming convention: `unplayable-{section}.png/svg`

## 🚀 Deployment

### Automatic Deployment (GitHub Pages)

The site automatically deploys to GitHub Pages when changes are pushed to the main branch. The workflow is defined in `.github/workflows/deploy-docs.yml`.

**Setup GitHub Pages:**

1. Go to repository Settings → Pages
2. Set Source to "GitHub Actions"
3. The site will be available at: `https://semicolonambulance.github.io/unplayable/`

### Manual Deployment

```bash
# Build the site
pnpm run build

# The built files will be in the dist/ directory
# Deploy the contents of dist/ to your hosting provider
```

### Local Preview of Production Build

```bash
pnpm run build
pnpm run preview
```

## 🛠 Development

### Adding New Features

1. **React Components**: Add to `src/components/`
2. **Styles**: Follow the existing CSS variable system
3. **Content**: Add markdown files to `public/`
4. **Tests**: Add corresponding test files

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for React and TypeScript
- **Prettier**: Code formatting
- **CSS**: CSS modules or styled-components preferred

### Testing

- **Unit Tests**: Test React components with Vitest
- **Integration Tests**: Test markdown loading and rendering
- **E2E Tests**: Consider adding Playwright for full user flows

## 🔧 Configuration

### Vite Configuration

- **Base URL**: Set to `/unplayable/` for GitHub Pages
- **Port**: Development server runs on port 3002
- **Build**: Optimized for production with code splitting

### TypeScript Configuration

- **Strict mode**: Enabled for type safety
- **Module resolution**: Bundler mode for Vite compatibility
- **JSX**: React JSX transform

## 📝 Content Guidelines

### Markdown Files

- Use clear, descriptive headings
- Include code examples with syntax highlighting
- Add TypeScript type annotations
- Use callout boxes for important information

### Code Examples

```typescript
// Good: Complete, runnable examples
import { createUnplayable } from '@theunwalked/unplayable';

const unplayable = await createUnplayable();
const result = await unplayable.processAudio({
  maxRecordingTime: 30
});
```

### Documentation Structure

- **Getting Started**: Quick setup and basic usage
- **API Reference**: Complete method documentation
- **Integration Examples**: Real-world usage patterns
- **Configuration**: All configuration options
- **Error Handling**: Comprehensive error scenarios
- **Development**: Contributing and building

## 🐛 Troubleshooting

### Common Issues

**Build Fails:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
pnpm install
```

**Development Server Won't Start:**
```bash
# Check port availability
lsof -i :3002
# Kill existing process if needed
kill -9 <PID>
```

**Markdown Not Loading:**
- Ensure files are in `public/` directory
- Check file names match exactly in `DOC_SECTIONS`
- Verify markdown syntax is valid

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/SemicolonAmbulance/unplayable/issues)
- **Discussions**: [GitHub Discussions](https://github.com/SemicolonAmbulance/unplayable/discussions)
- **Documentation**: This site itself! 