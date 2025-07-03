import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

import {
    detectBestAudioDevice,
    parseAudioDevices,
    validateAudioDevice,
    getAudioDeviceInfo,
    listAudioDevices,
    findWorkingAudioDevice,
    saveAudioDeviceConfig,
    loadAudioDeviceConfig,
    audioDeviceConfigExists
} from '../src/devices';

// Mock the child process utilities
vi.mock('../src/util/child', () => ({
    run: vi.fn()
}));

// Mock the file system operations
vi.mock('fs/promises', () => ({
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    access: vi.fn()
}));

describe('Audio Device Management', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset file system mocks
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.readFile).mockResolvedValue('');
        vi.mocked(fs.access).mockResolvedValue(undefined);
    });

    describe('parseAudioDevices', () => {
        it('should parse FFmpeg device list output', async () => {
            const { run } = await import('../src/util/child');
            vi.mocked(run).mockResolvedValue({
                code: 1, // FFmpeg returns error code but device list in stderr
                stdout: '',
                stderr: `AVFoundation video devices:
[0] FaceTime HD Camera
[1] OBS Virtual Camera
AVFoundation audio devices:
[0] Built-in Microphone
[1] MacBook Pro Microphone  
[2] AirPods Pro
[3] External USB Microphone`
            });

            const devices = await parseAudioDevices();

            expect(devices).toHaveLength(4);
            expect(devices[0]).toEqual({ index: '0', name: 'Built-in Microphone' });
            expect(devices[1]).toEqual({ index: '1', name: 'MacBook Pro Microphone' });
            expect(devices[2]).toEqual({ index: '2', name: 'AirPods Pro' });
            expect(devices[3]).toEqual({ index: '3', name: 'External USB Microphone' });
        });

        it('should handle empty device list', async () => {
            const { run } = await import('../src/util/child');
            vi.mocked(run).mockResolvedValue({
                code: 1,
                stdout: '',
                stderr: 'No audio devices found'
            });

            const devices = await parseAudioDevices();
            expect(devices).toHaveLength(0);
        });

        it('should handle FFmpeg errors gracefully', async () => {
            const { run } = await import('../src/util/child');
            vi.mocked(run).mockRejectedValue(new Error('FFmpeg not found'));

            const devices = await parseAudioDevices();
            expect(devices).toHaveLength(0);
        });
    });

    describe('detectBestAudioDevice', () => {
        it('should prefer AirPods over built-in microphone', async () => {
            const { run } = await import('../src/util/child');

            // Mock device list call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation video devices:
[0] FaceTime HD Camera
[1] OBS Virtual Camera
AVFoundation audio devices:
[0] Built-in Microphone
[1] AirPods Pro
[2] External Speaker`
            });

            // Mock device validation calls - AirPods validation succeeds
            vi.mocked(run).mockResolvedValueOnce({
                code: 0, // Success for AirPods Pro
                stdout: '',
                stderr: ''
            });

            const bestDevice = await detectBestAudioDevice();
            expect(bestDevice).toBe('1'); // AirPods Pro
        });

        it('should prefer MacBook microphone over generic devices', async () => {
            const { run } = await import('../src/util/child');

            // Mock device list call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation video devices:
[0] FaceTime HD Camera
AVFoundation audio devices:
[0] Generic USB Audio
[1] MacBook Pro Microphone
[2] Unknown Device`
            });

            // Mock device validation calls - MacBook Pro Microphone validation succeeds
            vi.mocked(run).mockResolvedValueOnce({
                code: 0, // Success for MacBook Pro Microphone
                stdout: '',
                stderr: ''
            });

            const bestDevice = await detectBestAudioDevice();
            expect(bestDevice).toBe('1'); // MacBook Pro Microphone
        });

        it('should fallback to device 1 when no preferred devices found', async () => {
            const { run } = await import('../src/util/child');

            // Mock device list call for findWorkingAudioDevice
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation video devices:
[0] FaceTime HD Camera
AVFoundation audio devices:
[0] Unknown Device A
[1] Unknown Device B
[2] Unknown Device C`
            });

            // Mock validation calls that will fail (no preferred devices)
            vi.mocked(run).mockResolvedValue({
                code: 1, // Validation fails
                stdout: '',
                stderr: 'Device access failed'
            });

            const bestDevice = await detectBestAudioDevice();
            expect(bestDevice).toBe('1'); // Default fallback
        });

        it('should handle errors and return default device', async () => {
            const { run } = await import('../src/util/child');

            // Mock the first call to fail completely
            vi.mocked(run).mockRejectedValueOnce(new Error('FFmpeg failed'));

            const bestDevice = await detectBestAudioDevice();
            expect(bestDevice).toBe('1'); // Default fallback
        });
    });

    describe('validateAudioDevice', () => {
        it('should validate existing device', async () => {
            const { run } = await import('../src/util/child');

            // Mock device list call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone
[1] MacBook Pro Microphone`
            });

            // Mock device test call
            vi.mocked(run).mockResolvedValueOnce({
                code: 0, // Success
                stdout: '',
                stderr: ''
            });

            const isValid = await validateAudioDevice('1');
            expect(isValid).toBe(true);
        });

        it('should reject non-existent device', async () => {
            const { run } = await import('../src/util/child');

            // Mock device list call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone
[1] MacBook Pro Microphone`
            });

            const isValid = await validateAudioDevice('999'); // Non-existent device
            expect(isValid).toBe(false);
        });

        it('should handle device access errors', async () => {
            const { run } = await import('../src/util/child');

            // Mock device list call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone`
            });

            // Mock device test call that fails
            vi.mocked(run).mockResolvedValueOnce({
                code: 1, // Failure
                stdout: '',
                stderr: 'Device access denied'
            });

            const isValid = await validateAudioDevice('0');
            expect(isValid).toBe(false);
        });

        it('should handle device test exceptions', async () => {
            const { run } = await import('../src/util/child');

            // Mock device list call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone`
            });

            // Mock device test call that throws an exception
            vi.mocked(run).mockRejectedValueOnce(new Error('Device test failed'));

            const isValid = await validateAudioDevice('0');
            expect(isValid).toBe(false);
        });
    });

    describe('getAudioDeviceInfo', () => {
        it('should return device configuration for valid device', async () => {
            const { run } = await import('../src/util/child');

            // Mock device list call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone
[1] MacBook Pro Microphone`
            });

            // Mock device info call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: 'Device info: 44100 Hz, 1 ch (mono)'
            });

            const deviceInfo = await getAudioDeviceInfo('1');

            expect(deviceInfo).toBeDefined();
            expect(deviceInfo?.audioDevice).toBe('1');
            expect(deviceInfo?.audioDeviceName).toBe('MacBook Pro Microphone');
        });

        it('should return null for non-existent device', async () => {
            const { run } = await import('../src/util/child');

            // Mock device list call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone`
            });

            const deviceInfo = await getAudioDeviceInfo('999');
            expect(deviceInfo).toBeNull();
        });

        it('should handle device info parsing errors gracefully', async () => {
            const { run } = await import('../src/util/child');

            // Mock device list call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone`
            });

            // Mock device info call that fails
            vi.mocked(run).mockRejectedValueOnce(new Error('Info call failed'));

            const deviceInfo = await getAudioDeviceInfo('0');

            // Should still return basic info even if detailed info fails
            expect(deviceInfo).toBeDefined();
            expect(deviceInfo?.audioDevice).toBe('0');
            expect(deviceInfo?.audioDeviceName).toBe('Built-in Microphone');
        });

        it('should parse device capabilities with sample rate and channels', async () => {
            const { run } = await import('../src/util/child');

            // Mock device list call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[1] MacBook Pro Microphone`
            });

            // Mock device info call with detailed capabilities
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: 'Device capabilities: 44100 Hz, 2 ch (stereo), 16-bit'
            });

            const deviceInfo = await getAudioDeviceInfo('1');

            expect(deviceInfo).toBeDefined();
            expect(deviceInfo?.audioDevice).toBe('1');
            expect(deviceInfo?.audioDeviceName).toBe('MacBook Pro Microphone');
            expect(deviceInfo?.sampleRate).toBe(44100);
            expect(deviceInfo?.channels).toBe(2);
            expect(deviceInfo?.channelLayout).toBe('stereo');
        });

        it('should parse device capabilities with mono channel', async () => {
            const { run } = await import('../src/util/child');

            // Mock device list call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone`
            });

            // Mock device info call with mono capabilities
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: 'Device capabilities: 48000 Hz, 1 ch (mono), 24-bit'
            });

            const deviceInfo = await getAudioDeviceInfo('0');

            expect(deviceInfo).toBeDefined();
            expect(deviceInfo?.audioDevice).toBe('0');
            expect(deviceInfo?.audioDeviceName).toBe('Built-in Microphone');
            expect(deviceInfo?.sampleRate).toBe(48000);
            expect(deviceInfo?.channels).toBe(1);
            expect(deviceInfo?.channelLayout).toBe('mono');
        });
    });

    describe('listAudioDevices', () => {
        it('should return the same result as parseAudioDevices', async () => {
            const { run } = await import('../src/util/child');
            vi.mocked(run).mockResolvedValue({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone
[1] MacBook Pro Microphone`
            });

            const devices = await listAudioDevices();

            expect(devices).toHaveLength(2);
            expect(devices[0]).toEqual({ index: '0', name: 'Built-in Microphone' });
            expect(devices[1]).toEqual({ index: '1', name: 'MacBook Pro Microphone' });
        });
    });

    describe('findWorkingAudioDevice', () => {
        it('should return preferred device in working order', async () => {
            const { run } = await import('../src/util/child');

            // Mock device list call for findWorkingAudioDevice
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Generic Device
[1] AirPods Pro
[2] Built-in Microphone`
            });

            // Mock device list call for validateAudioDevice (AirPods Pro)
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Generic Device
[1] AirPods Pro
[2] Built-in Microphone`
            });

            // Mock validation test call - AirPods validation succeeds
            vi.mocked(run).mockResolvedValueOnce({
                code: 0, // Success for AirPods Pro
                stdout: '',
                stderr: ''
            });

            const workingDevice = await findWorkingAudioDevice();

            expect(workingDevice).toEqual({ index: '1', name: 'AirPods Pro' });
        });

        it('should test devices in preference order and return first working one', async () => {
            const { run } = await import('../src/util/child');

            // Mock device list call for findWorkingAudioDevice
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Generic Device
[1] MacBook Pro Microphone
[2] Other Device`
            });

            // Mock device list call for validateAudioDevice (MacBook Pro Microphone - first in preference order)
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Generic Device
[1] MacBook Pro Microphone
[2] Other Device`
            });

            // Mock validation test call that fails for MacBook Pro Microphone
            vi.mocked(run).mockResolvedValueOnce({
                code: 1, // Failure for MacBook Pro Microphone
                stdout: '',
                stderr: 'Access denied'
            });

            // Mock device list call for validateAudioDevice (Generic Device)
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Generic Device
[1] MacBook Pro Microphone
[2] Other Device`
            });

            // Mock validation test call that succeeds for Generic Device
            vi.mocked(run).mockResolvedValueOnce({
                code: 0, // Success for Generic Device
                stdout: '',
                stderr: ''
            });

            const workingDevice = await findWorkingAudioDevice();

            expect(workingDevice).toEqual({ index: '0', name: 'Generic Device' });
        });

        it('should return null when no devices are available', async () => {
            const { run } = await import('../src/util/child');

            // Mock device list call with no devices - parseAudioDevices returns empty array when no "AVFoundation audio devices:" section
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: 'FFmpeg error: no devices detected'
            });

            const workingDevice = await findWorkingAudioDevice();
            expect(workingDevice).toBeNull();
        });

        it('should return null when no devices work', async () => {
            const { run } = await import('../src/util/child');

            // Mock device list call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Device A
[1] Device B`
            });

            // Mock validation calls - both devices fail
            vi.mocked(run).mockResolvedValue({
                code: 1, // All devices fail
                stdout: '',
                stderr: 'Access denied'
            });

            const workingDevice = await findWorkingAudioDevice();

            expect(workingDevice).toBeNull();
        });

        it('should handle errors and return null', async () => {
            const { run } = await import('../src/util/child');

            // Mock the first call to fail completely
            vi.mocked(run).mockRejectedValueOnce(new Error('FFmpeg failed'));

            const workingDevice = await findWorkingAudioDevice();

            expect(workingDevice).toBeNull();
        });
    });

    describe('saveAudioDeviceConfig', () => {
        beforeEach(() => {
            vi.mocked(fs.mkdir).mockResolvedValue(undefined);
            vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        });

        it('should save audio device configuration to JSON file', async () => {
            const config = {
                audioDevice: '1',
                audioDeviceName: 'MacBook Pro Microphone',
                sampleRate: 44100,
                channels: 1,
                channelLayout: 'mono' as const
            };
            const preferencesDir = '/test/preferences';

            await saveAudioDeviceConfig(config, preferencesDir);

            expect(fs.mkdir).toHaveBeenCalledWith(preferencesDir, { recursive: true });
            expect(fs.writeFile).toHaveBeenCalledWith(
                path.join(preferencesDir, 'audio-device.json'),
                JSON.stringify(config, null, 2),
                'utf8'
            );
        });

        it('should handle write errors', async () => {
            const config = {
                audioDevice: '1',
                audioDeviceName: 'Test Device'
            };
            const preferencesDir = '/test/preferences';

            vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write failed'));

            await expect(saveAudioDeviceConfig(config, preferencesDir)).rejects.toThrow('Failed to save audio device configuration: Error: Write failed');
        });

        it('should handle directory creation errors', async () => {
            const config = {
                audioDevice: '1',
                audioDeviceName: 'Test Device'
            };
            const preferencesDir = '/test/preferences';

            vi.mocked(fs.mkdir).mockRejectedValue(new Error('Permission denied'));

            await expect(saveAudioDeviceConfig(config, preferencesDir)).rejects.toThrow('Failed to save audio device configuration: Error: Permission denied');
        });
    });

    describe('loadAudioDeviceConfig', () => {
        it('should load audio device configuration from JSON file', async () => {
            const config = {
                audioDevice: '1',
                audioDeviceName: 'MacBook Pro Microphone',
                sampleRate: 44100,
                channels: 1,
                channelLayout: 'mono' as const
            };
            const preferencesDir = '/test/preferences';

            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(config));

            const loadedConfig = await loadAudioDeviceConfig(preferencesDir);

            expect(loadedConfig).toEqual(config);
            expect(fs.readFile).toHaveBeenCalledWith(
                path.join(preferencesDir, 'audio-device.json'),
                'utf8'
            );
        });

        it('should return null when config file does not exist', async () => {
            const preferencesDir = '/test/preferences';
            const error = new Error('File not found') as any;
            error.code = 'ENOENT';

            vi.mocked(fs.readFile).mockRejectedValue(error);

            const loadedConfig = await loadAudioDeviceConfig(preferencesDir);

            expect(loadedConfig).toBeNull();
        });

        it('should handle JSON parsing errors', async () => {
            const preferencesDir = '/test/preferences';

            vi.mocked(fs.readFile).mockResolvedValue('invalid json');

            const loadedConfig = await loadAudioDeviceConfig(preferencesDir);

            expect(loadedConfig).toBeNull();
        });

        it('should handle other read errors', async () => {
            const preferencesDir = '/test/preferences';

            vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));

            const loadedConfig = await loadAudioDeviceConfig(preferencesDir);

            expect(loadedConfig).toBeNull();
        });
    });

    describe('audioDeviceConfigExists', () => {
        it('should return true when config file exists', async () => {
            const preferencesDir = '/test/preferences';

            vi.mocked(fs.access).mockResolvedValue(undefined);

            const exists = await audioDeviceConfigExists(preferencesDir);

            expect(exists).toBe(true);
            expect(fs.access).toHaveBeenCalledWith(
                path.join(preferencesDir, 'audio-device.json')
            );
        });

        it('should return false when config file does not exist', async () => {
            const preferencesDir = '/test/preferences';

            vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

            const exists = await audioDeviceConfigExists(preferencesDir);

            expect(exists).toBe(false);
        });
    });
}); 