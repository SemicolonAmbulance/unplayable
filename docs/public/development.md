# Development

Guide for contributing to Unplayable, building from source, and understanding the project structure.

## Getting Started

### Prerequisites

- **Node.js** 18+ with npm/pnpm/yarn
- **TypeScript** knowledge for development
- **FFmpeg** for testing non-macOS functionality
- **OpenAI API key** for testing transcription features

### Building from Source

```bash
# Clone the repository
git clone https://github.com/SemicolonAmbulance/unplayable.git
cd unplayable

# Install dependencies
pnpm install
# or
npm install

# Build the project
pnpm run build

# Run tests
pnpm test

# Start development mode with watch
pnpm run dev
```

### Project Structure

```
unplayable/
├── src/                        # Source code
│   ├── unplayable.ts          # Main library exports
│   ├── processor.ts           # Audio processing logic
│   ├── devices.ts             # Device management
│   ├── configuration.ts       # Configuration handling
│   ├── validation.ts          # Input validation
│   ├── types.ts               # TypeScript type definitions
│   ├── error/                 # Custom error classes
│   │   ├── AudioError.ts
│   │   ├── UnplayableError.ts
│   │   └── index.ts
│   └── util/                  # Utility functions
│       ├── child.ts           # Child process utilities
│       └── storage.ts         # File system utilities
├── tests/                     # Test files
├── docs/                      # Documentation website
├── coverage/                  # Test coverage reports
├── dist/                      # Compiled JavaScript (git-ignored)
└── README.md                  # Main documentation
```

## Development Workflow

### Scripts

```bash
# Development
pnpm run dev          # Watch mode with TypeScript compilation
pnpm run build        # Production build
pnpm run clean        # Clean build artifacts

# Testing
pnpm test             # Run all tests
pnpm test --coverage  # Run tests with coverage report
pnpm test --watch     # Run tests in watch mode
pnpm run test:unit    # Run unit tests only
pnpm run test:integration # Run integration tests only

# Code Quality
pnpm run lint         # Check for linting errors
pnpm run lint:fix     # Fix auto-fixable linting errors
pnpm run format       # Format code with Prettier
pnpm run type-check   # TypeScript type checking

# Documentation
pnpm run docs:dev     # Start documentation site locally
pnpm run docs:build   # Build documentation for deployment
```

### Code Style

The project uses ESLint and Prettier for consistent code formatting:

```bash
# Format all files
pnpm run format

# Check linting
pnpm run lint

# Auto-fix linting issues
pnpm run lint:fix
```

### Environment Setup

Create a `.env` file for local development:

```bash
# Required for testing transcription
OPENAI_API_KEY=sk-your-development-key

# Optional: Custom paths for testing
UNPLAYABLE_OUTPUT_DIR=./dev-recordings
UNPLAYABLE_LOG_LEVEL=debug
FFMPEG_PATH=/usr/local/bin/ffmpeg
```

## Testing

### Test Structure

```
tests/
├── unplayable.test.ts          # Main API tests
├── processor.test.ts           # Audio processing tests
├── devices.test.ts             # Device management tests
├── configuration.test.ts       # Configuration tests
├── validation.test.ts          # Input validation tests
├── error/                      # Error handling tests
│   ├── AudioError.test.ts
│   └── UnplayableError.test.ts
└── util/                       # Utility function tests
    ├── child.test.ts
    └── storage.test.ts
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test unplayable.test.ts

# Run tests with coverage
pnpm test --coverage

# Run tests in watch mode (useful during development)
pnpm test --watch

# Run tests with debug output
DEBUG=1 pnpm test
```

### Writing Tests

Follow these patterns for new tests:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createUnplayable } from '../src/unplayable';
import { AudioProcessingError } from '../src/error';

describe('Audio Processing', () => {
  let unplayable: any;

  beforeEach(async () => {
    // Setup test instance
    unplayable = await createUnplayable({
      config: {
        outputDirectory: './test-recordings',
        logging: { level: 'error', silent: true }
      }
    });
  });

  afterEach(async () => {
    // Cleanup test files
    // ... cleanup logic
  });

  it('should process audio successfully', async () => {
    const result = await unplayable.processAudio({
      maxRecordingTime: 1 // Short recording for tests
    });

    expect(result).toBeDefined();
    expect(result.transcript).toBeTypeOf('string');
  });

  it('should handle invalid input gracefully', async () => {
    await expect(
      unplayable.transcribeFile('./non-existent-file.mp3')
    ).rejects.toThrow(AudioProcessingError);
  });
});
```

### Integration Tests

Integration tests require real system resources:

```typescript
describe.skipIf(!process.env.INTEGRATION_TESTS)('Device Integration', () => {
  it('should detect real audio devices', async () => {
    const devices = await getAudioDevices();
    // Tests only run if INTEGRATION_TESTS=true
  });
});
```

Run integration tests:

```bash
INTEGRATION_TESTS=true pnpm test
```

## Architecture

### Core Components

#### `Unplayable` Class

Main class providing the public API:

```typescript
class Unplayable {
  constructor(private config: UnplayableConfig, private logger: Logger) {}
  
  // Audio processing methods
  async processAudio(options: AudioProcessingOptions): Promise<AudioProcessingResult>
  async recordAudio(options: AudioProcessingOptions): Promise<string>
  async transcribeFile(filePath: string, options?: AudioProcessingOptions): Promise<string>
  
  // Device management
  async getAudioDevices(): Promise<AudioDevice[]>
  async validateDevice(deviceIndex: string): Promise<boolean>
  
  // Configuration
  getConfig(): UnplayableConfig
  updateConfig(updates: Partial<UnplayableConfig>): void
}
```

#### Audio Processor

Handles the core audio recording and processing logic:

```typescript
class AudioProcessor {
  async record(options: RecordingOptions): Promise<string>
  async transcribe(audioPath: string): Promise<string>
  private async executeFFmpeg(command: string[]): Promise<void>
  private async callOpenAI(audioPath: string): Promise<string>
}
```

#### Device Manager

Manages audio device detection and validation:

```typescript
class DeviceManager {
  async listDevices(): Promise<AudioDevice[]>
  async validateDevice(index: string): Promise<boolean>
  async detectBestDevice(): Promise<string>
  private async querySystemDevices(): Promise<AudioDevice[]>
}
```

### Configuration System

Configuration is handled through a hierarchical system:

1. **Runtime configuration** (passed to `createUnplayable()`)
2. **Environment variables** (`OPENAI_API_KEY`, `UNPLAYABLE_*`)
3. **Configuration files** (`unplayable.config.json`)
4. **Built-in defaults**

```typescript
class ConfigurationManager {
  static async load(overrides?: Partial<UnplayableConfig>): Promise<UnplayableConfig>
  private static loadFromFile(path: string): Promise<Partial<UnplayableConfig>>
  private static loadFromEnvironment(): Partial<UnplayableConfig>
  private static getDefaults(): UnplayableConfig
}
```

### Error Handling

Custom error hierarchy for specific error types:

```typescript
// Base error class
export class UnplayableError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Specific error types
export class AudioProcessingError extends UnplayableError {}
export class AudioRecordingError extends UnplayableError {}
export class AudioDeviceError extends UnplayableError {}
export class AudioConfigurationError extends UnplayableError {}
```

## Contributing

### Pull Request Process

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Make** your changes following the coding standards
4. **Add** tests for new functionality
5. **Ensure** all tests pass (`pnpm test`)
6. **Lint** your code (`pnpm run lint:fix`)
7. **Commit** your changes (`git commit -m 'Add amazing feature'`)
8. **Push** to the branch (`git push origin feature/amazing-feature`)
9. **Open** a Pull Request

### Commit Message Format

Follow conventional commit format:

```
type(scope): description

- feat: new feature
- fix: bug fix
- docs: documentation changes
- style: formatting changes
- refactor: code refactoring
- test: adding or updating tests
- chore: maintenance tasks

Examples:
feat(devices): add bluetooth device support
fix(processor): handle FFmpeg timeout errors
docs(api): update transcription examples
```

### Code Guidelines

#### TypeScript Standards

- Use strict TypeScript configuration
- Prefer interfaces over types for public APIs
- Use meaningful generic type parameters
- Document complex type definitions

```typescript
// Good
interface AudioProcessingOptions {
  /** Maximum recording duration in seconds */
  maxRecordingTime?: number;
  /** Target audio device index */
  audioDevice?: string;
}

// Avoid
type Options = {
  maxTime?: number;
  device?: string;
}
```

#### Function Design

- Use async/await for asynchronous operations
- Validate inputs early
- Provide meaningful error messages
- Use dependency injection for testability

```typescript
// Good
async function processAudio(
  options: AudioProcessingOptions,
  processor: AudioProcessor = defaultProcessor
): Promise<AudioProcessingResult> {
  if (!options.maxRecordingTime || options.maxRecordingTime <= 0) {
    throw new AudioProcessingError('Invalid recording time');
  }
  
  return await processor.process(options);
}
```

#### Testing Guidelines

- Write tests for all public APIs
- Test error conditions
- Use descriptive test names
- Mock external dependencies

```typescript
// Good
describe('Audio processing with invalid device', () => {
  it('should throw AudioDeviceError when device index is invalid', async () => {
    await expect(
      unplayable.processAudio({ audioDevice: 'invalid-device' })
    ).rejects.toThrow(AudioDeviceError);
  });
});

// Avoid
it('should fail', async () => {
  await expect(processAudio({})).rejects.toThrow();
});
```

### Documentation

#### Code Documentation

Use JSDoc for public APIs:

```typescript
/**
 * Process audio input through recording and transcription
 * 
 * @param options - Configuration options for audio processing
 * @param options.maxRecordingTime - Maximum recording duration in seconds
 * @param options.audioDevice - Target audio device index
 * @returns Promise resolving to processing results including transcript
 * 
 * @throws {AudioDeviceError} When specified device is unavailable
 * @throws {AudioRecordingError} When recording fails
 * @throws {AudioProcessingError} When transcription fails
 * 
 * @example
 * ```typescript
 * const result = await unplayable.processAudio({
 *   maxRecordingTime: 30,
 *   audioDevice: '1'
 * });
 * console.log('Transcript:', result.transcript);
 * ```
 */
async processAudio(options: AudioProcessingOptions): Promise<AudioProcessingResult>
```

#### README Updates

When adding new features:

1. Update the feature list
2. Add API documentation
3. Include usage examples
4. Update troubleshooting section if needed

### Release Process

Releases are managed through semantic versioning:

1. **Update version** in `package.json`
2. **Update** `CHANGELOG.md` with changes
3. **Create** a release tag (`git tag v1.2.3`)
4. **Push** tags (`git push --tags`)
5. **GitHub Actions** will automatically publish to NPM

### Development Environment

#### VS Code Configuration

Recommended VS Code extensions:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

#### Debug Configuration

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run", "--reporter=verbose"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Troubleshooting Development Issues

### Common Setup Problems

#### FFmpeg Not Found

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Verify installation
ffmpeg -version
```

#### TypeScript Compilation Errors

```bash
# Clean and rebuild
pnpm run clean
pnpm run build

# Check TypeScript configuration
pnpm run type-check
```

#### Test Failures

```bash
# Run tests with debug output
DEBUG=1 pnpm test

# Run specific failing test
pnpm test -- --reporter=verbose failing-test.test.ts

# Check test coverage
pnpm test --coverage
```

### Platform-Specific Development

#### macOS Development

- AVFoundation is available by default
- Test with various microphone types
- Check system permissions for microphone access

#### Linux Development

- Install ALSA/PulseAudio development libraries
- Test with different audio systems
- Verify FFmpeg ALSA support

#### Windows Development

- Install FFmpeg manually or via package manager
- Test with WASAPI and DirectShow devices
- Handle Windows path separators in file operations

For additional help, check the [GitHub Issues](https://github.com/SemicolonAmbulance/unplayable/issues) or start a [Discussion](https://github.com/SemicolonAmbulance/unplayable/discussions). 