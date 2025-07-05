# API Reference

Complete documentation of all classes, functions, and types in the Unplayable library.

## Core Classes

### `Unplayable`

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

## Factory Functions

### `createUnplayable(options?)`

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

**Parameters:**
- `options.config` *(optional)*: Configuration overrides
- `options.logger` *(optional)*: Custom logger instance

**Returns:** `Promise<Unplayable>`

## Convenience Functions

### `processAudio(options)`

Process audio with minimal setup:

```typescript
import { processAudio } from '@theunwalked/unplayable';

const result = await processAudio({
  maxRecordingTime: 60,
  outputDirectory: './recordings'
});
```

**Parameters:** `Partial<AudioProcessingOptions>`
**Returns:** `Promise<AudioProcessingResult>`

### `recordAudio(options?)`

Record audio and return file path:

```typescript
import { recordAudio } from '@theunwalked/unplayable';

const audioPath = await recordAudio({
  maxRecordingTime: 30
});
```

**Parameters:** `Partial<AudioProcessingOptions>` *(optional)*
**Returns:** `Promise<string>` - Path to the recorded audio file

### `getAudioDevices()`

List available audio devices:

```typescript
import { getAudioDevices } from '@theunwalked/unplayable';

const devices = await getAudioDevices();
```

**Returns:** `Promise<AudioDevice[]>`

## Types

### `AudioProcessingOptions`

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

### `AudioProcessingResult`

```typescript
interface AudioProcessingResult {
  audioFilePath?: string;          // Path to the audio file
  cancelled: boolean;              // Whether operation was cancelled
  metadata?: AudioProcessingMetadata; // Additional metadata
}
```

### `AudioDevice`

```typescript
interface AudioDevice {
  index: string;                   // Device index as string identifier
  name: string;                    // Human-readable device name
}
```

### `UnplayableConfig`

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

### `AudioDeviceConfig`

```typescript
interface AudioDeviceConfig {
  index: string;                   // Device index identifier
  name: string;                    // Device display name
  isDefault?: boolean;             // Whether this is the default device
}
```

### `AudioProcessingMetadata`

```typescript
interface AudioProcessingMetadata {
  duration?: number;               // Audio duration in seconds
  fileSize?: number;               // File size in bytes
  format?: string;                 // Audio format
  sampleRate?: number;             // Sample rate in Hz
  channels?: number;               // Number of audio channels
  processingTime?: number;         // Time taken to process in ms
}
```

## Error Types

The library provides comprehensive error types for different failure scenarios:

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

### `AudioProcessingError`

Thrown when audio processing operations fail.

### `AudioRecordingError`

Thrown when audio recording operations fail.

### `AudioDeviceError`

Thrown when audio device operations fail.

### `AudioConfigurationError`

Thrown when configuration is invalid or missing. 