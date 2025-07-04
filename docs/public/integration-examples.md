# Integration Examples

Learn how to integrate Unplayable into different types of applications and frameworks.

## React Application

### Basic Audio Recorder Component

```typescript
import React, { useState } from 'react';
import { createUnplayable, AudioProcessingResult } from '@theunwalked/unplayable';

function AudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [result, setResult] = useState<AudioProcessingResult | null>(null);

  const handleRecord = async () => {
    setIsRecording(true);
    try {
      const unplayable = await createUnplayable();
      const result = await unplayable.processAudio({
        maxRecordingTime: 60
      });
      setResult(result);
    } catch (error) {
      console.error('Recording failed:', error);
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <div>
      <button onClick={handleRecord} disabled={isRecording}>
        {isRecording ? 'Recording...' : 'Start Recording'}
      </button>
      
      {result && (
        <div>
          <h3>Transcript:</h3>
          <p>{result.transcript}</p>
          {result.audioFilePath && (
            <audio controls src={result.audioFilePath} />
          )}
        </div>
      )}
    </div>
  );
}
```

### Advanced React Hook

```typescript
import { useState, useCallback } from 'react';
import { createUnplayable, AudioProcessingOptions, AudioProcessingResult } from '@theunwalked/unplayable';

export function useUnplayable() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processAudio = useCallback(async (options?: Partial<AudioProcessingOptions>) => {
    setIsRecording(true);
    setError(null);
    
    try {
      const unplayable = await createUnplayable();
      const result = await unplayable.processAudio(options);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsRecording(false);
    }
  }, []);

  const transcribeFile = useCallback(async (filePath: string) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const unplayable = await createUnplayable();
      const transcript = await unplayable.transcribeFile(filePath);
      return transcript;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    processAudio,
    transcribeFile,
    isRecording,
    isProcessing,
    error
  };
}
```

## Express.js API

### RESTful Audio API

```typescript
import express from 'express';
import multer from 'multer';
import { createUnplayable } from '@theunwalked/unplayable';

const app = express();
const upload = multer({ dest: 'uploads/' });
const unplayable = await createUnplayable();

// Transcribe uploaded audio file
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const transcript = await unplayable.transcribeFile(req.file.path);
    
    res.json({ 
      transcript,
      filename: req.file.originalname 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

// List available audio devices
app.get('/devices', async (req, res) => {
  try {
    const devices = await unplayable.getAudioDevices();
    res.json({ devices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Audio API server running on port 3000');
});
```

### Streaming Audio Endpoint

```typescript
import { pipeline } from 'stream';
import { createReadStream } from 'fs';

app.get('/audio/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const audioPath = path.join('./recordings', filename);
    
    // Validate file exists and is supported
    await unplayable.validateAudioFile(audioPath);
    
    const stream = createReadStream(audioPath);
    res.setHeader('Content-Type', 'audio/mpeg');
    
    pipeline(stream, res, (err) => {
      if (err) {
        console.error('Stream error:', err);
      }
    });
  } catch (error) {
    res.status(404).json({ error: 'Audio file not found' });
  }
});
```

## CLI Tool

### Command-Line Application

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { createUnplayable } from '@theunwalked/unplayable';

const program = new Command();

program
  .name('audio-cli')
  .description('Audio recording and transcription CLI')
  .version('1.0.0');

program
  .command('record')
  .description('Record audio')
  .option('-t, --time <seconds>', 'Recording time in seconds', '60')
  .option('-o, --output <directory>', 'Output directory', './recordings')
  .option('-d, --device <index>', 'Audio device index')
  .action(async (options) => {
    try {
      const unplayable = await createUnplayable();
      
      console.log('🎙️ Starting recording...');
      const result = await unplayable.processAudio({
        maxRecordingTime: parseInt(options.time),
        outputDirectory: options.output,
        audioDevice: options.device
      });
      
      console.log('✅ Recording completed!');
      console.log('📝 Transcript:', result.transcript);
      console.log('🎵 Audio file:', result.audioFilePath);
    } catch (error) {
      console.error('❌ Recording failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('transcribe <file>')
  .description('Transcribe audio file')
  .option('-o, --output <directory>', 'Output directory for transcript')
  .action(async (file, options) => {
    try {
      const unplayable = await createUnplayable();
      
      console.log('🎯 Transcribing audio...');
      const transcript = await unplayable.transcribeFile(file, {
        outputDirectory: options.output
      });
      
      console.log('📝 Transcript:', transcript);
    } catch (error) {
      console.error('❌ Transcription failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('devices')
  .description('List audio devices')
  .action(async () => {
    try {
      const unplayable = await createUnplayable();
      const devices = await unplayable.getAudioDevices();
      
      console.log('🎤 Available audio devices:');
      devices.forEach(device => {
        console.log(`  [${device.index}] ${device.name}`);
      });
    } catch (error) {
      console.error('❌ Failed to list devices:', error.message);
      process.exit(1);
    }
  });

program.parse();
```

### Interactive CLI

```typescript
import inquirer from 'inquirer';

async function interactiveCLI() {
  const unplayable = await createUnplayable();
  
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          'Record Audio',
          'Transcribe File',
          'List Devices',
          'Exit'
        ]
      }
    ]);

    switch (action) {
      case 'Record Audio':
        await handleRecord(unplayable);
        break;
      case 'Transcribe File':
        await handleTranscribe(unplayable);
        break;
      case 'List Devices':
        await handleListDevices(unplayable);
        break;
      case 'Exit':
        process.exit(0);
    }
  }
}

async function handleRecord(unplayable) {
  const { duration, device } = await inquirer.prompt([
    {
      type: 'number',
      name: 'duration',
      message: 'Recording duration (seconds):',
      default: 30
    },
    {
      type: 'input',
      name: 'device',
      message: 'Device index (leave empty for default):'
    }
  ]);

  const result = await unplayable.processAudio({
    maxRecordingTime: duration,
    audioDevice: device || undefined
  });

  console.log('Transcript:', result.transcript);
}
```

## Next.js Application

### API Route

```typescript
// pages/api/audio/transcribe.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { createUnplayable } from '@theunwalked/unplayable';
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({ multiples: false });
    const [, files] = await form.parse(req);
    
    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const unplayable = await createUnplayable();
    const transcript = await unplayable.transcribeFile(audioFile.filepath);

    res.json({ transcript });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### Client-Side Component

```typescript
// components/AudioRecorder.tsx
import { useState } from 'react';

export default function AudioRecorder() {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('audio', file);

    try {
      const response = await fetch('/api/audio/transcribe', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      setTranscript(result.transcript);
    } catch (error) {
      console.error('Transcription failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleFileUpload}>
      <input
        type="file"
        accept="audio/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button type="submit" disabled={!file || loading}>
        {loading ? 'Transcribing...' : 'Transcribe'}
      </button>
      {transcript && <p>Transcript: {transcript}</p>}
    </form>
  );
}
```

## Electron Application

### Main Process Integration

```typescript
// main.ts
import { app, ipcMain } from 'electron';
import { createUnplayable } from '@theunwalked/unplayable';

let unplayable: any;

app.whenReady(async () => {
  unplayable = await createUnplayable({
    config: {
      outputDirectory: path.join(app.getPath('userData'), 'recordings')
    }
  });

  // Handle recording requests from renderer
  ipcMain.handle('record-audio', async (event, options) => {
    return await unplayable.processAudio(options);
  });

  ipcMain.handle('transcribe-file', async (event, filePath) => {
    return await unplayable.transcribeFile(filePath);
  });

  ipcMain.handle('get-devices', async () => {
    return await unplayable.getAudioDevices();
  });
});
```

### Renderer Process

```typescript
// renderer.ts
import { ipcRenderer } from 'electron';

class AudioManager {
  async recordAudio(options = {}) {
    return await ipcRenderer.invoke('record-audio', options);
  }

  async transcribeFile(filePath: string) {
    return await ipcRenderer.invoke('transcribe-file', filePath);
  }

  async getDevices() {
    return await ipcRenderer.invoke('get-devices');
  }
}

export const audioManager = new AudioManager();
``` 