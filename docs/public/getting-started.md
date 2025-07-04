# Getting Started

A cross-platform audio recording and processing library, designed to be easily integrated into other projects.

## Features

- 🎙️ **Cross-platform audio recording** via FFmpeg/AVFoundation
- 🎯 **Audio file processing** and validation
- 🔊 **Audio device management** with auto-detection
- 📝 **Speech-to-text transcription** (OpenAI Whisper)
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

console.log('Transcript:', result.transcript);
console.log('Audio file:', result.audioFilePath);
```

### Transcribe Existing Audio File

```typescript
import { transcribeFile } from '@theunwalked/unplayable';

// Simple transcription
const transcript = await transcribeFile('./my-audio.mp3');
console.log('Transcript:', transcript);

// With custom options
const transcript = await transcribeFile('./my-audio.mp3', {
  outputDirectory: './transcripts'
});
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