# Error Handling

Comprehensive guide to error handling, debugging, and troubleshooting in Unplayable.

## Error Types

Unplayable provides specific error types for different failure scenarios, making it easier to handle and debug issues.

### Core Error Types

```typescript
import { 
  AudioProcessingError,
  AudioRecordingError, 
  AudioDeviceError,
  AudioConfigurationError 
} from '@theunwalked/unplayable';
```

#### `AudioProcessingError`

Thrown when audio processing operations fail, such as transcription or file format issues.

```typescript
try {
  const transcript = await unplayable.transcribeFile('./corrupted-audio.mp3');
} catch (error) {
  if (error instanceof AudioProcessingError) {
    console.error('Processing failed:', error.message);
    // Handle: invalid file format, network issues, API errors
  }
}
```

**Common causes:**
- Invalid or corrupted audio files
- Unsupported audio formats
- OpenAI API errors or rate limits
- Network connectivity issues
- Insufficient disk space

#### `AudioRecordingError`

Thrown when audio recording operations fail.

```typescript
try {
  const audioPath = await unplayable.recordAudio({ maxRecordingTime: 30 });
} catch (error) {
  if (error instanceof AudioRecordingError) {
    console.error('Recording failed:', error.message);
    // Handle: device issues, permission problems, system errors
  }
}
```

**Common causes:**
- Audio device disconnected or unavailable
- Insufficient system permissions
- Audio device already in use
- System audio service failures
- Hardware malfunctions

#### `AudioDeviceError`

Thrown when audio device operations fail.

```typescript
try {
  const devices = await unplayable.getAudioDevices();
} catch (error) {
  if (error instanceof AudioDeviceError) {
    console.error('Device error:', error.message);
    // Handle: no devices found, driver issues, system problems
  }
}
```

**Common causes:**
- No audio devices detected
- Audio driver issues
- Device permission denied
- System audio service not running
- Hardware disconnection

#### `AudioConfigurationError`

Thrown when configuration is invalid or missing.

```typescript
try {
  const unplayable = await createUnplayable({
    config: { openai: { apiKey: '' } } // Invalid config
  });
} catch (error) {
  if (error instanceof AudioConfigurationError) {
    console.error('Configuration error:', error.message);
    // Handle: missing API keys, invalid paths, malformed config
  }
}
```

**Common causes:**
- Missing OpenAI API key
- Invalid file paths
- Malformed configuration files
- Environment variable issues
- Permission problems with config directories

## Comprehensive Error Handling

### Basic Error Handling Pattern

```typescript
import { createUnplayable } from '@theunwalked/unplayable';

async function handleAudioOperation() {
  try {
    const unplayable = await createUnplayable();
    const result = await unplayable.processAudio({
      maxRecordingTime: 30
    });
    
    console.log('Success:', result.transcript);
    return result;
    
  } catch (error) {
    console.error('Operation failed:', error.message);
    
    // Handle specific error types
    if (error instanceof AudioDeviceError) {
      await handleDeviceError(error);
    } else if (error instanceof AudioRecordingError) {
      await handleRecordingError(error);
    } else if (error instanceof AudioProcessingError) {
      await handleProcessingError(error);
    } else if (error instanceof AudioConfigurationError) {
      await handleConfigurationError(error);
    } else {
      await handleUnknownError(error);
    }
    
    throw error; // Re-throw if needed
  }
}
```

### Advanced Error Handling

```typescript
class AudioErrorHandler {
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 1000;

  async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    while (this.retryCount < this.maxRetries) {
      try {
        return await operation();
      } catch (error) {
        this.retryCount++;
        
        if (this.shouldRetry(error) && this.retryCount < this.maxRetries) {
          console.log(`Retry ${this.retryCount}/${this.maxRetries} in ${this.retryDelay}ms...`);
          await this.delay(this.retryDelay);
          this.retryDelay *= 2; // Exponential backoff
          continue;
        }
        
        throw this.enhanceError(error);
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  private shouldRetry(error: any): boolean {
    // Retry on transient errors
    return error instanceof AudioDeviceError ||
           error instanceof AudioRecordingError ||
           (error instanceof AudioProcessingError && 
            error.message.includes('network'));
  }

  private enhanceError(error: any): Error {
    const context = {
      timestamp: new Date().toISOString(),
      retryCount: this.retryCount,
      errorType: error.constructor.name,
      originalMessage: error.message
    };
    
    const enhancedMessage = `${error.message} (Context: ${JSON.stringify(context)})`;
    
    // Preserve original error type
    const enhancedError = new (error.constructor as any)(enhancedMessage);
    enhancedError.stack = error.stack;
    enhancedError.context = context;
    
    return enhancedError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const errorHandler = new AudioErrorHandler();

const result = await errorHandler.executeWithRetry(async () => {
  const unplayable = await createUnplayable();
  return await unplayable.processAudio({ maxRecordingTime: 30 });
});
```

## Specific Error Scenarios

### Configuration Errors

```typescript
async function handleConfigurationError(error: AudioConfigurationError) {
  console.error('Configuration Error:', error.message);
  
  if (error.message.includes('API key')) {
    console.log('💡 Solution: Set OPENAI_API_KEY environment variable');
    console.log('   export OPENAI_API_KEY="sk-your-key"');
    
  } else if (error.message.includes('directory')) {
    console.log('💡 Solution: Check directory permissions and paths');
    console.log('   mkdir -p ~/.unplayable');
    console.log('   chmod 755 ~/.unplayable');
    
  } else if (error.message.includes('FFmpeg')) {
    console.log('💡 Solution: Install FFmpeg');
    console.log('   macOS: brew install ffmpeg');
    console.log('   Ubuntu: sudo apt install ffmpeg');
    console.log('   Windows: Download from ffmpeg.org');
  }
}
```

### Device Errors

```typescript
async function handleDeviceError(error: AudioDeviceError) {
  console.error('Device Error:', error.message);
  
  // Try to recover by listing available devices
  try {
    const unplayable = await createUnplayable();
    const devices = await unplayable.getAudioDevices();
    
    if (devices.length === 0) {
      console.log('💡 No audio devices found. Please:');
      console.log('   1. Connect a microphone');
      console.log('   2. Check system audio settings');
      console.log('   3. Grant microphone permissions');
      
    } else {
      console.log('💡 Available devices:');
      devices.forEach(device => {
        console.log(`   [${device.index}] ${device.name}`);
      });
      console.log('   Try specifying a device index explicitly');
    }
    
  } catch (recoveryError) {
    console.log('💡 Unable to list devices. System audio may be unavailable.');
  }
}
```

### Recording Errors

```typescript
async function handleRecordingError(error: AudioRecordingError) {
  console.error('Recording Error:', error.message);
  
  if (error.message.includes('permission')) {
    console.log('💡 Permission denied. Please:');
    console.log('   macOS: System Preferences > Security & Privacy > Microphone');
    console.log('   Windows: Settings > Privacy > Microphone');
    console.log('   Linux: Check PulseAudio/ALSA permissions');
    
  } else if (error.message.includes('device busy')) {
    console.log('💡 Device in use. Please:');
    console.log('   1. Close other audio applications');
    console.log('   2. Try a different audio device');
    console.log('   3. Restart audio services');
    
  } else if (error.message.includes('timeout')) {
    console.log('💡 Recording timeout. This may indicate:');
    console.log('   1. Device connection issues');
    console.log('   2. System performance problems');
    console.log('   3. Audio driver malfunction');
  }
}
```

### Processing Errors

```typescript
async function handleProcessingError(error: AudioProcessingError) {
  console.error('Processing Error:', error.message);
  
  if (error.message.includes('API key')) {
    console.log('💡 OpenAI API key issue:');
    console.log('   1. Verify OPENAI_API_KEY is set');
    console.log('   2. Check API key is valid');
    console.log('   3. Ensure sufficient API credits');
    
  } else if (error.message.includes('network')) {
    console.log('💡 Network connectivity issue:');
    console.log('   1. Check internet connection');
    console.log('   2. Verify firewall settings');
    console.log('   3. Try again in a few moments');
    
  } else if (error.message.includes('format')) {
    console.log('💡 Audio format issue:');
    console.log('   1. Check file is not corrupted');
    console.log('   2. Try converting to a supported format');
    console.log('   3. Verify file is actually audio content');
    
  } else if (error.message.includes('rate limit')) {
    console.log('💡 API rate limit exceeded:');
    console.log('   1. Wait before making more requests');
    console.log('   2. Consider upgrading API plan');
    console.log('   3. Implement request queuing');
  }
}
```

## Debugging Tools

### Debug Mode

Enable debug logging for detailed error information:

```typescript
const unplayable = await createUnplayable({
  config: {
    logging: {
      level: 'debug',
      silent: false
    }
  }
});

// Debug mode provides:
// - Detailed operation logs
// - FFmpeg command output
// - API request/response details
// - File system operations
// - Device detection steps
```

### Error Context

Extract useful context from errors:

```typescript
function analyzeError(error: any) {
  const analysis = {
    type: error.constructor.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    
    // Additional context if available
    context: error.context || {},
    
    // System information
    platform: process.platform,
    nodeVersion: process.version,
    
    // Environment checks
    hasFFmpeg: await checkFFmpegAvailable(),
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    workingDirectory: process.cwd()
  };
  
  console.log('🔍 Error Analysis:', JSON.stringify(analysis, null, 2));
  return analysis;
}

async function checkFFmpegAvailable(): Promise<boolean> {
  try {
    const { exec } = require('child_process');
    await new Promise((resolve, reject) => {
      exec('ffmpeg -version', (error) => {
        if (error) reject(error);
        else resolve(true);
      });
    });
    return true;
  } catch {
    return false;
  }
}
```

### Health Check

Implement a comprehensive health check:

```typescript
async function performHealthCheck() {
  const checks = [];
  
  // Configuration check
  try {
    await createUnplayable();
    checks.push({ name: 'Configuration', status: '✅ OK' });
  } catch (error) {
    checks.push({ name: 'Configuration', status: '❌ FAIL', error: error.message });
  }
  
  // Device check
  try {
    const unplayable = await createUnplayable();
    const devices = await unplayable.getAudioDevices();
    checks.push({ 
      name: 'Audio Devices', 
      status: devices.length > 0 ? '✅ OK' : '⚠️  WARNING',
      details: `${devices.length} device(s) found`
    });
  } catch (error) {
    checks.push({ name: 'Audio Devices', status: '❌ FAIL', error: error.message });
  }
  
  // FFmpeg check (non-macOS)
  if (process.platform !== 'darwin') {
    try {
      await checkFFmpegAvailable();
      checks.push({ name: 'FFmpeg', status: '✅ OK' });
    } catch (error) {
      checks.push({ name: 'FFmpeg', status: '❌ FAIL', error: 'Not found in PATH' });
    }
  }
  
  // OpenAI API check
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  checks.push({ 
    name: 'OpenAI API Key', 
    status: hasApiKey ? '✅ OK' : '❌ MISSING',
    details: hasApiKey ? 'Set' : 'OPENAI_API_KEY environment variable not found'
  });
  
  // Output results
  console.log('\n🏥 Health Check Results:');
  checks.forEach(check => {
    console.log(`${check.status} ${check.name}`);
    if (check.details) console.log(`   ${check.details}`);
    if (check.error) console.log(`   Error: ${check.error}`);
  });
  
  const allOk = checks.every(check => check.status.includes('✅'));
  console.log(`\n${allOk ? '✅' : '❌'} Overall Status: ${allOk ? 'Healthy' : 'Issues Detected'}`);
  
  return { healthy: allOk, checks };
}
```

## Best Practices

### Graceful Degradation

```typescript
async function robustAudioProcessing(options: any) {
  const fallbackStrategies = [
    // Strategy 1: Use preferred device
    () => unplayable.processAudio({ ...options, audioDevice: preferredDevice }),
    
    // Strategy 2: Use auto-detected device
    () => unplayable.processAudio({ ...options, audioDevice: undefined }),
    
    // Strategy 3: Use first available device
    async () => {
      const devices = await unplayable.getAudioDevices();
      if (devices.length === 0) throw new Error('No devices available');
      return unplayable.processAudio({ ...options, audioDevice: devices[0].index });
    },
    
    // Strategy 4: File upload fallback
    () => {
      console.log('Recording failed. Please upload an audio file instead.');
      throw new Error('Recording unavailable - file upload required');
    }
  ];
  
  for (const [index, strategy] of fallbackStrategies.entries()) {
    try {
      console.log(`Trying strategy ${index + 1}...`);
      return await strategy();
    } catch (error) {
      console.log(`Strategy ${index + 1} failed:`, error.message);
      if (index === fallbackStrategies.length - 1) {
        throw error; // Last strategy failed
      }
    }
  }
}
```

### Error Recovery

```typescript
class AudioSession {
  private unplayable: any;
  private lastKnownGoodDevice?: string;
  
  async initialize() {
    try {
      this.unplayable = await createUnplayable();
      
      // Test and save a working device
      const devices = await this.unplayable.getAudioDevices();
      for (const device of devices) {
        if (await this.unplayable.validateDevice(device.index)) {
          this.lastKnownGoodDevice = device.index;
          break;
        }
      }
      
    } catch (error) {
      console.error('Session initialization failed:', error.message);
      throw error;
    }
  }
  
  async record(options: any) {
    try {
      return await this.unplayable.processAudio(options);
      
    } catch (error) {
      if (error instanceof AudioDeviceError && this.lastKnownGoodDevice) {
        console.log('Retrying with last known good device...');
        return await this.unplayable.processAudio({
          ...options,
          audioDevice: this.lastKnownGoodDevice
        });
      }
      
      throw error;
    }
  }
}
``` 