# Unplayable

A cross-platform audio recording and processing library, designed to be easily integrated into other projects.

## Features

- 🎙️ **Cross-platform audio recording** via FFmpeg/AVFoundation
- 🎯 **Audio file processing** and validation
- 🔊 **Audio device management** with auto-detection
- ⚙️ **Flexible configuration** with environment variable support
- 🧪 **Comprehensive testing** and TypeScript support
- 📦 **Library-first design** for easy integration

## Installation

```bash
npm install @theunwalked/unplayable
# or
pnpm add @theunwalked/unplayable
# or
yarn add @theunwalked/unplayable
```

### System Requirements

- **macOS**: AVFoundation support (built-in)
- **FFmpeg**: Required for audio recording and processing
- **Node.js**: 18+ with TypeScript support

#### Installing FFmpeg

**macOS (Homebrew):**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html) or use Chocolatey:
```bash
choco install ffmpeg
```

## Quick Start

### Basic Audio Recording

```typescript
import { createUnplayable } from '@theunwalked/unplayable';

// Create instance with default configuration
const unplayable = await createUnplayable();

// Record audio for 30 seconds
const result = await unplayable.processAudio({
  maxRecordingTime: 30
});

console.log('Audio file:', result.audioFilePath);
```

### List and Validate Audio Devices

```typescript
import { getAudioDevices } from '@theunwalked/unplayable';

// List all available audio devices
const devices = await getAudioDevices();
devices.forEach(device => {
  console.log(`[${device.index}] ${device.name}`);
});

// Validate and get device info
const unplayable = await createUnplayable();
const isValid = await unplayable.validateDevice('1');
const deviceInfo = await unplayable.getDeviceInfo('1');
```

## Configuration

### Environment Variables

```bash
# OpenAI API configuration
export OPENAI_API_KEY="sk-your-api-key-here"
export OPENAI_MODEL="whisper-1"
export OPENAI_BASE_URL="https://api.openai.com/v1"

# Directory configuration  
export UNPLAYABLE_OUTPUT_DIR="/path/to/recordings"
export UNPLAYABLE_PREFS_DIR="/path/to/preferences"

# Logging configuration
export UNPLAYABLE_LOG_LEVEL="debug"
export UNPLAYABLE_SILENT="false"

# FFmpeg configuration
export FFMPEG_PATH="/usr/local/bin/ffmpeg"
export FFMPEG_TIMEOUT="30000"
```

### Configuration File

Create `unplayable.config.json` in your project root or `~/.unplayable/config.json`:

```json
{
  "outputDirectory": "./recordings",
  "preferencesDirectory": "~/.unplayable",
  "openai": {
    "apiKey": "sk-your-api-key",
    "model": "whisper-1"
  },
  "logging": {
    "level": "info",
    "silent": false
  },
  "ffmpeg": {
    "timeout": 30000
  }
}
```

### Programmatic Configuration

```typescript
import { createUnplayable } from '@theunwalked/unplayable';

const unplayable = await createUnplayable({
  config: {
    outputDirectory: './my-recordings',
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'whisper-1'
    },
    logging: {
      level: 'debug'
    }
  }
});
```

## API Reference

### Core Classes

#### `Unplayable`

Main library class providing comprehensive audio functionality.

```typescript
class Unplayable {
  // Audio processing
  async processAudio(options?: Partial<AudioProcessingOptions>): Promise<AudioProcessingResult>
  async recordAudio(options?: Partial<AudioProcessingOptions>): Promise<string>
  
  // Device management
  async getAudioDevices(): Promise<AudioDevice[]>
  async detectBestDevice(): Promise<string>
  async validateDevice(deviceIndex: string): Promise<boolean>
  async getDeviceInfo(deviceIndex: string): Promise<AudioDeviceConfig | null>
  
  // Configuration management
  getConfig(): UnplayableConfig
  updateConfig(updates: Partial<UnplayableConfig>): void
  async saveConfig(configPath?: string): Promise<void>
  
  // Validation
  async validateAudioFile(filePath: string): Promise<void>
  isSupportedAudioFile(filePath: string): boolean
}
```

### Factory Functions

#### `createUnplayable(options?)`

Creates a configured Unplayable instance.

```typescript
const unplayable = await createUnplayable({
  config: {
    outputDirectory: './recordings',
    logging: { level: 'debug' }
  },
  logger: customLogger
});
```

### Convenience Functions

#### `processAudio(options)`

Process audio with minimal setup:

```typescript
import { processAudio } from '@theunwalked/unplayable';

const result = await processAudio({
  maxRecordingTime: 60,
  outputDirectory: './recordings'
});
```

#### `recordAudio(options?)`

Record audio and return file path:

```typescript
import { recordAudio } from '@theunwalked/unplayable';

const audioPath = await recordAudio({
  maxRecordingTime: 30
});
```

#### `getAudioDevices()`

List available audio devices:

```typescript
import { getAudioDevices } from '@theunwalked/unplayable';

const devices = await getAudioDevices();
```

### Types

#### `AudioProcessingOptions`

```typescript
interface AudioProcessingOptions {
  file?: string;                    // Input file path (for processing existing files)
  audioDevice?: string;             // Audio device index for recording
  maxRecordingTime?: number;        // Maximum recording time in seconds
  outputDirectory?: string;         // Output directory for saved files
  preferencesDirectory?: string;    // Preferences directory for device config
  debug?: boolean;                  // Enable debug mode
  dryRun?: boolean;                // Dry run mode (no actual recording/processing)
  keepTemp?: boolean;              // Keep temporary files for inspection
  logger?: Logger;                 // Custom logger instance
}
```

#### `AudioProcessingResult`

```typescript
interface AudioProcessingResult {
  audioFilePath?: string;          // Path to the audio file
  cancelled: boolean;              // Whether operation was cancelled
  metadata?: AudioProcessingMetadata; // Additional metadata
}
```

#### `AudioDevice`

```typescript
interface AudioDevice {
  index: string;                   // Device index as string identifier
  name: string;                    // Human-readable device name
}
```

#### `UnplayableConfig`

```typescript
interface UnplayableConfig {
  defaultDevice?: AudioDeviceConfig;
  outputDirectory?: string;
  preferencesDirectory?: string;
  openai?: {
    apiKey?: string;
    model?: string;
    baseURL?: string;
  };
  logging?: {
    level?: 'error' | 'warn' | 'info' | 'debug';
    silent?: boolean;
  };
  ffmpeg?: {
    path?: string;
    timeout?: number;
  };
}
```

## Integration Examples

### Integration with Express.js API

```typescript
import express from 'express';
import multer from 'multer';
import { createUnplayable } from '@theunwalked/unplayable';

const app = express();
const upload = multer({ dest: 'uploads/' });
const unplayable = await createUnplayable();

// Record new audio
app.post('/record', async (req, res) => {
  try {
    const { maxTime = 60 } = req.body;
    
    const result = await unplayable.processAudio({
      maxRecordingTime: maxTime,
      outputDirectory: './recordings'
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Audio API server running on port 3000');
});
```

## Supported Audio Formats

- **MP3** (.mp3)
- **WAV** (.wav) 
- **FLAC** (.flac)
- **AAC** (.aac)
- **M4A** (.m4a)
- **OGG** (.ogg)
- **Opus** (.opus)
- **WebM** (.webm)
- **MPEG** (.mpeg, .mpga)
- **MP4** (.mp4)

## Error Handling

The library provides comprehensive error types:

```typescript
import { 
  AudioProcessingError,
  AudioRecordingError, 
  AudioDeviceError,
  AudioConfigurationError 
} from '@theunwalked/unplayable';

try {
  await unplayable.processAudio(options);
} catch (error) {
  if (error instanceof AudioDeviceError) {
    console.error('Device error:', error.message);
  } else if (error instanceof AudioRecordingError) {
    console.error('Recording error:', error.message);
  } else if (error instanceof AudioProcessingError) {
    console.error('Processing error:', error.message);
  } else if (error instanceof AudioConfigurationError) {
    console.error('Configuration error:', error.message);
  }
}
```

## Development

### Building from Source

```bash
git clone https://github.com/SemicolonAmbulance/unplayable.git
cd unplayable
pnpm install
pnpm run build
```

### Running Tests

```bash
pnpm test                 # Run all tests
pnpm test --coverage      # Run tests with coverage
pnpm test --watch         # Run tests in watch mode
```

### Linting and Formatting

```bash
pnpm run lint            # Check for linting errors
pnpm run lint:fix        # Fix linting errors
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and add tests
4. Ensure tests pass (`pnpm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with the same patterns as [CardiganTime](https://github.com/SemicolonAmbulance/cardigantime)
- Uses [OpenAI Whisper](https://openai.com/research/whisper) for speech-to-text
- Powered by [FFmpeg](https://ffmpeg.org/) for audio processing

## Related SemicolonAmbulance Libraries

- **[CardiganTime](https://github.com/SemicolonAmbulance/cardigantime)** - Configuration management library
- **[DreadCabinet](https://github.com/SemicolonAmbulance/dreadcabinet)** - File organization tool