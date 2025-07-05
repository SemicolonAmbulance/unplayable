# Configuration

Unplayable supports multiple configuration methods to suit different deployment scenarios and preferences.

## Environment Variables

Configure Unplayable using environment variables for easy deployment and CI/CD integration:

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

### Environment Variable Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `UNPLAYABLE_OUTPUT_DIR` | Directory for recordings | `./recordings` |
| `UNPLAYABLE_PREFS_DIR` | Directory for preferences | `~/.unplayable` |
| `UNPLAYABLE_LOG_LEVEL` | Logging level | `info` |
| `UNPLAYABLE_SILENT` | Silent mode (disable console output) | `false` |
| `FFMPEG_PATH` | Path to FFmpeg executable | Auto-detected |
| `FFMPEG_TIMEOUT` | FFmpeg operation timeout (ms) | `30000` |

## Configuration File

Create a configuration file for persistent settings. Unplayable looks for configuration files in this order:

1. `unplayable.config.json` in your project root
2. `~/.unplayable/config.json` in your home directory
3. Environment variables (see above)
4. Built-in defaults

### Example Configuration File

```json
{
  "outputDirectory": "./recordings",
  "preferencesDirectory": "~/.unplayable",
  "openai": {
    "apiKey": "sk-your-api-key",
    "model": "whisper-1",
    "baseURL": "https://api.openai.com/v1"
  },
  "logging": {
    "level": "info",
    "silent": false
  },
  "ffmpeg": {
    "path": "/usr/local/bin/ffmpeg",
    "timeout": 30000
  },
  "defaultDevice": {
    "index": "1",
    "name": "Built-in Microphone",
    "isDefault": true
  }
}
```

### Configuration Schema

#### Root Configuration

| Property | Type | Description |
|----------|------|-------------|
| `outputDirectory` | `string` | Directory for saving recordings |
| `preferencesDirectory` | `string` | Directory for preferences and cache |
| `openai` | `object` | OpenAI configuration |
| `logging` | `object` | Logging configuration |
| `ffmpeg` | `object` | FFmpeg configuration |
| `defaultDevice` | `object` | Default audio device |

#### OpenAI Configuration

| Property | Type | Description |
|----------|------|-------------|
| `apiKey` | `string` | OpenAI API key |
| `model` | `string` | Whisper model name |
| `baseURL` | `string` | API base URL |

#### Logging Configuration

| Property | Type | Description |
|----------|------|-------------|
| `level` | `string` | Log level: `error`, `warn`, `info`, `debug` |
| `silent` | `boolean` | Disable console output |

#### FFmpeg Configuration

| Property | Type | Description |
|----------|------|-------------|
| `path` | `string` | Path to FFmpeg executable |
| `timeout` | `number` | Operation timeout in milliseconds |

#### Device Configuration

| Property | Type | Description |
|----------|------|-------------|
| `index` | `string` | Device index identifier |
| `name` | `string` | Human-readable device name |
| `isDefault` | `boolean` | Whether this is the default device |

## Programmatic Configuration

Configure Unplayable directly in your code for maximum flexibility:

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
    },
    ffmpeg: {
      timeout: 60000
    }
  }
});
```

### Updating Configuration at Runtime

```typescript
// Get current configuration
const currentConfig = unplayable.getConfig();

// Update specific settings
unplayable.updateConfig({
  outputDirectory: './new-recordings',
  logging: { level: 'error' }
});

// Save configuration to file
await unplayable.saveConfig('./my-config.json');
```

## Configuration Priority

Configuration values are resolved in this order (highest to lowest priority):

1. **Programmatic configuration** - Values passed to `createUnplayable()`
2. **Environment variables** - `OPENAI_API_KEY`, `UNPLAYABLE_*`, etc.
3. **Project config file** - `./unplayable.config.json`
4. **Global config file** - `~/.unplayable/config.json`
5. **Built-in defaults** - Sensible fallback values

## Validation

Unplayable validates configuration at startup and provides helpful error messages:

```typescript
try {
  const unplayable = await createUnplayable();
} catch (error) {
  if (error instanceof AudioConfigurationError) {
    console.error('Configuration error:', error.message);
    // Handle missing API key, invalid paths, etc.
  }
}
```

### Common Configuration Issues

- **Missing OpenAI API Key**: Set `OPENAI_API_KEY` environment variable
- **Invalid output directory**: Ensure the path exists and is writable
- **FFmpeg not found**: Install FFmpeg or set `FFMPEG_PATH`
- **Invalid log level**: Use `error`, `warn`, `info`, or `debug`

## Best Practices

### Development

```json
{
  "outputDirectory": "./dev-recordings",
  "logging": {
    "level": "debug",
    "silent": false
  },
  "openai": {
    "apiKey": "${OPENAI_API_KEY}"
  }
}
```

### Production

```json
{
  "outputDirectory": "/var/app/recordings",
  "preferencesDirectory": "/var/app/config",
  "logging": {
    "level": "warn",
    "silent": false
  },
  "ffmpeg": {
    "timeout": 60000
  }
}
```

### CI/CD

Use environment variables exclusively:

```bash
export OPENAI_API_KEY="sk-test-key"
export UNPLAYABLE_OUTPUT_DIR="/tmp/test-recordings"
export UNPLAYABLE_LOG_LEVEL="error"
export UNPLAYABLE_SILENT="true"
``` 