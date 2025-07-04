# Audio Formats & Device Management

Comprehensive guide to supported audio formats and audio device management in Unplayable.

## Supported Audio Formats

Unplayable supports a wide range of audio formats for both input and output:

### Input Formats (Transcription)

- **MP3** (.mp3) - MPEG-1 Audio Layer 3
- **WAV** (.wav) - Waveform Audio File Format  
- **FLAC** (.flac) - Free Lossless Audio Codec
- **AAC** (.aac) - Advanced Audio Coding
- **M4A** (.m4a) - MPEG-4 Audio
- **OGG** (.ogg) - Ogg Vorbis
- **Opus** (.opus) - Opus Audio Codec
- **WebM** (.webm) - WebM Audio
- **MPEG** (.mpeg, .mpga) - MPEG Audio
- **MP4** (.mp4) - MPEG-4 Video (audio track)

### Output Formats (Recording)

Default recording format depends on the platform:

- **macOS**: M4A (AAC) via AVFoundation
- **Other platforms**: WAV via FFmpeg

### Format Validation

Check if an audio file is supported:

```typescript
import { createUnplayable } from '@theunwalked/unplayable';

const unplayable = await createUnplayable();

// Check by file extension
const isSupported = unplayable.isSupportedAudioFile('./audio.mp3');
console.log('Supported:', isSupported); // true

// Validate actual file
try {
  await unplayable.validateAudioFile('./audio.mp3');
  console.log('File is valid and playable');
} catch (error) {
  console.error('File validation failed:', error.message);
}
```

## Audio Device Management

Unplayable provides comprehensive audio device detection and management capabilities.

### Listing Available Devices

```typescript
import { getAudioDevices } from '@theunwalked/unplayable';

// Get all available input devices
const devices = await getAudioDevices();

devices.forEach(device => {
  console.log(`[${device.index}] ${device.name}`);
});

// Example output:
// [0] Built-in Microphone
// [1] USB Audio Device
// [2] Bluetooth Headset
```

### Device Detection and Selection

```typescript
import { createUnplayable } from '@theunwalked/unplayable';

const unplayable = await createUnplayable();

// Auto-detect the best available device
const bestDevice = await unplayable.detectBestDevice();
console.log('Best device:', bestDevice);

// Validate a specific device
const isValid = await unplayable.validateDevice('1');
if (isValid) {
  console.log('Device 1 is available');
}

// Get detailed device information
const deviceInfo = await unplayable.getDeviceInfo('1');
if (deviceInfo) {
  console.log('Device:', deviceInfo.name);
  console.log('Index:', deviceInfo.index);
  console.log('Is Default:', deviceInfo.isDefault);
}
```

### Recording with Specific Devices

```typescript
// Record using a specific device
const result = await unplayable.processAudio({
  audioDevice: '1', // Use device index
  maxRecordingTime: 30
});

// Record using auto-detected best device
const result2 = await unplayable.processAudio({
  audioDevice: await unplayable.detectBestDevice(),
  maxRecordingTime: 30
});
```

### Device Configuration Persistence

```typescript
// Save preferred device to configuration
unplayable.updateConfig({
  defaultDevice: {
    index: '1',
    name: 'USB Microphone',
    isDefault: true
  }
});

// Save configuration to file
await unplayable.saveConfig();

// Later, the saved device will be used automatically
const result = await unplayable.processAudio({
  maxRecordingTime: 30
  // Will use saved default device
});
```

## Platform-Specific Behavior

### macOS

- Uses **AVFoundation** for high-quality audio recording
- Automatic device detection and permission handling
- Supports hardware audio devices and virtual audio drivers
- Default format: M4A (AAC encoding)

```typescript
// macOS-specific configuration
const unplayable = await createUnplayable({
  config: {
    // AVFoundation automatically handles device permissions
    // and provides optimal quality settings
  }
});
```

### Linux/Windows

- Uses **FFmpeg** for cross-platform audio recording
- Requires FFmpeg to be installed and accessible
- Supports ALSA, PulseAudio, WASAPI, and DirectShow devices
- Default format: WAV (PCM encoding)

```typescript
// Configure FFmpeg path if not in system PATH
const unplayable = await createUnplayable({
  config: {
    ffmpeg: {
      path: '/usr/local/bin/ffmpeg', // or 'C:\\ffmpeg\\bin\\ffmpeg.exe'
      timeout: 60000 // 60 second timeout
    }
  }
});
```

## Device Discovery

### Automatic Discovery

```typescript
async function discoverDevices() {
  const unplayable = await createUnplayable();
  
  console.log('🎤 Discovering audio devices...');
  const devices = await unplayable.getAudioDevices();
  
  if (devices.length === 0) {
    console.log('No audio devices found');
    return;
  }
  
  console.log(`Found ${devices.length} audio device(s):`);
  
  for (const device of devices) {
    console.log(`  [${device.index}] ${device.name}`);
    
    // Test device availability
    const isValid = await unplayable.validateDevice(device.index);
    console.log(`    Status: ${isValid ? '✅ Available' : '❌ Unavailable'}`);
  }
  
  // Find the best device
  const bestDevice = await unplayable.detectBestDevice();
  console.log(`\n🎯 Recommended device: ${bestDevice}`);
}
```

### Device Monitoring

```typescript
class DeviceMonitor {
  private unplayable: any;
  private lastDeviceList: string[] = [];
  
  constructor(unplayable: any) {
    this.unplayable = unplayable;
  }
  
  async startMonitoring(intervalMs = 5000) {
    setInterval(async () => {
      const devices = await this.unplayable.getAudioDevices();
      const currentDeviceList = devices.map(d => d.index);
      
      if (JSON.stringify(currentDeviceList) !== JSON.stringify(this.lastDeviceList)) {
        console.log('🔄 Audio devices changed');
        this.lastDeviceList = currentDeviceList;
        this.onDevicesChanged(devices);
      }
    }, intervalMs);
  }
  
  private onDevicesChanged(devices: any[]) {
    console.log('Updated device list:');
    devices.forEach(device => {
      console.log(`  [${device.index}] ${device.name}`);
    });
  }
}

// Usage
const unplayable = await createUnplayable();
const monitor = new DeviceMonitor(unplayable);
await monitor.startMonitoring();
```

## Quality and Performance

### Recording Quality Settings

While Unplayable doesn't expose direct audio quality controls (these are handled optimally by the underlying audio systems), you can influence quality through configuration:

```typescript
const unplayable = await createUnplayable({
  config: {
    // Longer timeout allows for higher quality processing
    ffmpeg: {
      timeout: 120000 // 2 minutes for complex audio processing
    }
  }
});
```

### Device-Specific Optimizations

```typescript
async function optimizeForDevice(deviceIndex: string) {
  const unplayable = await createUnplayable();
  const deviceInfo = await unplayable.getDeviceInfo(deviceIndex);
  
  if (!deviceInfo) {
    throw new Error('Device not found');
  }
  
  // Different optimization strategies based on device name
  let config = {};
  
  if (deviceInfo.name.includes('USB')) {
    // USB devices often have higher latency but better quality
    config = {
      ffmpeg: { timeout: 90000 }
    };
  } else if (deviceInfo.name.includes('Bluetooth')) {
    // Bluetooth devices may have connection issues
    config = {
      ffmpeg: { timeout: 45000 }
    };
  } else if (deviceInfo.name.includes('Built-in')) {
    // Built-in devices are usually most reliable
    config = {
      ffmpeg: { timeout: 30000 }
    };
  }
  
  unplayable.updateConfig(config);
  return unplayable;
}
```

## Troubleshooting

### Common Device Issues

#### No Devices Found

```typescript
const devices = await getAudioDevices();
if (devices.length === 0) {
  console.error('No audio devices detected');
  console.log('Troubleshooting steps:');
  console.log('1. Check if microphone is connected');
  console.log('2. Verify system audio permissions');
  console.log('3. Restart audio services');
  console.log('4. Check FFmpeg installation (non-macOS)');
}
```

#### Device Validation Failed

```typescript
const isValid = await unplayable.validateDevice('1');
if (!isValid) {
  console.error('Device validation failed');
  console.log('Device may be:');
  console.log('- Disconnected or unplugged');
  console.log('- In use by another application');
  console.log('- Requires system permissions');
  console.log('- Not compatible with current audio driver');
}
```

#### Recording Failures

```typescript
try {
  const result = await unplayable.processAudio({
    audioDevice: '1',
    maxRecordingTime: 30
  });
} catch (error) {
  if (error.message.includes('device')) {
    console.error('Device error - try a different device');
    const devices = await unplayable.getAudioDevices();
    console.log('Available devices:', devices);
  } else if (error.message.includes('permission')) {
    console.error('Permission denied - check system audio permissions');
  } else if (error.message.includes('timeout')) {
    console.error('Recording timeout - check device connection');
  }
}
```

### Diagnostic Commands

```typescript
async function runDiagnostics() {
  console.log('🔍 Running audio diagnostics...\n');
  
  const unplayable = await createUnplayable();
  
  // Test device listing
  console.log('1. Device Discovery:');
  const devices = await unplayable.getAudioDevices();
  console.log(`   Found ${devices.length} device(s)`);
  
  // Test each device
  console.log('\n2. Device Validation:');
  for (const device of devices) {
    const isValid = await unplayable.validateDevice(device.index);
    console.log(`   [${device.index}] ${device.name}: ${isValid ? '✅' : '❌'}`);
  }
  
  // Test best device detection
  console.log('\n3. Best Device Detection:');
  try {
    const bestDevice = await unplayable.detectBestDevice();
    console.log(`   Best device: ${bestDevice}`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  // Test configuration
  console.log('\n4. Configuration:');
  const config = unplayable.getConfig();
  console.log(`   Output directory: ${config.outputDirectory || 'default'}`);
  console.log(`   FFmpeg timeout: ${config.ffmpeg?.timeout || 'default'}`);
  
  console.log('\n✅ Diagnostics complete');
}
``` 