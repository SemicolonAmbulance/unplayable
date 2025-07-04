import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    audioDeviceConfigExists,
    testAudioDevice,
    selectAudioDeviceInteractively,
    selectAndConfigureAudioDevice
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

        it('should handle malformed device lines', async () => {
            const { run } = await import('../src/util/child');
            vi.mocked(run).mockResolvedValue({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone
[1 MacBook Pro Microphone (malformed - no closing bracket)
Invalid line without brackets
[2] AirPods Pro`
            });

            const devices = await parseAudioDevices();
            expect(devices).toHaveLength(2);
            expect(devices[0]).toEqual({ index: '0', name: 'Built-in Microphone' });
            expect(devices[1]).toEqual({ index: '2', name: 'AirPods Pro' });
        });

        it('should handle output from stdout instead of stderr', async () => {
            const { run } = await import('../src/util/child');
            vi.mocked(run).mockResolvedValue({
                code: 0,
                stdout: `AVFoundation audio devices:
[0] Built-in Microphone
[1] MacBook Pro Microphone`,
                stderr: ''
            });

            const devices = await parseAudioDevices();
            expect(devices).toHaveLength(2);
            expect(devices[0]).toEqual({ index: '0', name: 'Built-in Microphone' });
            expect(devices[1]).toEqual({ index: '1', name: 'MacBook Pro Microphone' });
        });

        it('should use logger for debugging', async () => {
            const { run } = await import('../src/util/child');
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            vi.mocked(run).mockResolvedValue({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone
[1] MacBook Pro Microphone`
            });

            await parseAudioDevices(mockLogger);
            expect(mockLogger.debug).toHaveBeenCalledWith('Found 2 audio devices');
        });

        it('should use logger for error reporting', async () => {
            const { run } = await import('../src/util/child');
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            vi.mocked(run).mockRejectedValue(new Error('FFmpeg not found'));

            await parseAudioDevices(mockLogger);
            expect(mockLogger.error).toHaveBeenCalledWith('Error parsing audio devices: Error: FFmpeg not found');
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

        it('should use logger for debugging when finding working device', async () => {
            const { run } = await import('../src/util/child');
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            // Mock device list call for findWorkingAudioDevice 
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone
[1] AirPods Pro`
            });

            // Mock device validation calls
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone
[1] AirPods Pro`
            });

            vi.mocked(run).mockResolvedValueOnce({
                code: 0, // AirPods validation succeeds
                stdout: '',
                stderr: ''
            });

            const result = await detectBestAudioDevice(mockLogger);
            expect(result).toBe('1');
            expect(mockLogger.debug).toHaveBeenCalledWith('Found 2 audio devices');
            expect(mockLogger.debug).toHaveBeenCalledWith('Testing audio device: [1] AirPods Pro');
            expect(mockLogger.debug).toHaveBeenCalledWith('✅ Best audio device detected: [1] AirPods Pro');
        });

        it('should handle fallback to preference-based detection when findWorkingAudioDevice fails', async () => {
            const { run } = await import('../src/util/child');

            // Mock findWorkingAudioDevice to fail
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: 'No audio devices found'
            });

            // Mock the preference-based detection calls
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone
[1] AirPods Pro`
            });

            const bestDevice = await detectBestAudioDevice();
            expect(bestDevice).toBe('1'); // Default fallback
        });

        it('should handle logger error reporting', async () => {
            const { run } = await import('../src/util/child');
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            // Mock the first call to fail for findWorkingAudioDevice
            vi.mocked(run).mockRejectedValueOnce(new Error('FFmpeg failed'));

            // Mock the fallback ffmpeg call to also fail
            vi.mocked(run).mockRejectedValueOnce(new Error('FFmpeg failed'));

            const result = await detectBestAudioDevice(mockLogger);
            expect(result).toBe('1'); // Should return default fallback
            expect(mockLogger.error).toHaveBeenCalledWith('Error parsing audio devices: Error: FFmpeg failed');
            expect(mockLogger.error).toHaveBeenCalledWith('Error finding working audio device: AudioDeviceError: No audio devices available');
        });
    });

    describe('detectBestAudioDevice - Additional Coverage', () => {
        it('should use fallback preference-based detection when findWorkingAudioDevice returns null', async () => {
            const { run } = await import('../src/util/child');

            // Mock findWorkingAudioDevice to return empty device list (triggers fallback)
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: 'No audio devices found'
            });

            // Mock fallback preference-based detection
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation video devices:
[0] FaceTime HD Camera
AVFoundation audio devices:
[0] Unknown Device
[1] MacBook Air Microphone
[2] Other Device`
            });

            const bestDevice = await detectBestAudioDevice();
            expect(bestDevice).toBe('1'); // Should find MacBook Air Microphone via preference
        });

        it('should handle preference detection with no audioDevicesSection', async () => {
            const { run } = await import('../src/util/child');

            // Mock findWorkingAudioDevice to fail
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: 'No audio devices found'
            });

            // Mock fallback with no audio devices section
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: 'AVFoundation video devices:\n[0] FaceTime HD Camera'
            });

            const bestDevice = await detectBestAudioDevice();
            expect(bestDevice).toBe('1'); // Should return default fallback
        });

        it('should handle ffmpeg error in preference detection fallback', async () => {
            const { run } = await import('../src/util/child');
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            // Mock findWorkingAudioDevice to fail
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: 'No audio devices found'
            });

            // Mock fallback ffmpeg call to fail
            vi.mocked(run).mockRejectedValueOnce(new Error('FFmpeg binary not found'));

            const bestDevice = await detectBestAudioDevice(mockLogger);
            expect(bestDevice).toBe('1'); // Should return default fallback
            expect(mockLogger.debug).toHaveBeenCalledWith('FFmpeg device listing failed: Error: FFmpeg binary not found');
        });

        it('should extract device index from preference match', async () => {
            const { run } = await import('../src/util/child');

            // Mock findWorkingAudioDevice to fail
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: 'No audio devices found'
            });

            // Mock fallback with AirPods device
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone
[3] AirPods Pro
[5] External Mic`
            });

            const bestDevice = await detectBestAudioDevice();
            expect(bestDevice).toBe('3'); // Should extract device index 3 for AirPods
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

    describe('validateAudioDevice - Additional Coverage', () => {
        it('should use logger for device test failures', async () => {
            const { run } = await import('../src/util/child');
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            // Mock device list call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone`
            });

            // Mock device test call that throws error
            vi.mocked(run).mockRejectedValueOnce(new Error('Device permission denied'));

            const isValid = await validateAudioDevice('0', mockLogger);
            expect(isValid).toBe(false);
            expect(mockLogger.debug).toHaveBeenCalledWith('Device test failed for 0: Error: Device permission denied');
        });

        it('should handle validateAudioDevice outer catch block', async () => {
            const { run } = await import('../src/util/child');
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            // Mock parseAudioDevices to throw error
            vi.mocked(run).mockRejectedValue(new Error('Network error'));

            const isValid = await validateAudioDevice('0', mockLogger);
            expect(isValid).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith('Error parsing audio devices: Error: Network error');
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

    describe('getAudioDeviceInfo - Additional Coverage', () => {
        it('should handle device info error and return basic info', async () => {
            const { run } = await import('../src/util/child');
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            // Mock device list call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[1] MacBook Pro Microphone`
            });

            // Mock device info call that throws error
            vi.mocked(run).mockRejectedValueOnce(new Error('Device info fetch failed'));

            const deviceInfo = await getAudioDeviceInfo('1', mockLogger);

            expect(deviceInfo).toEqual({
                audioDevice: '1',
                audioDeviceName: 'MacBook Pro Microphone'
            });
            expect(mockLogger.debug).toHaveBeenCalledWith('Failed to get detailed info for device 1: Error: Device info fetch failed');
        });

        it('should handle getAudioDeviceInfo outer catch block', async () => {
            const { run } = await import('../src/util/child');
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            // Mock parseAudioDevices to throw error
            vi.mocked(run).mockRejectedValue(new Error('System error'));

            const deviceInfo = await getAudioDeviceInfo('1', mockLogger);
            expect(deviceInfo).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith('Error parsing audio devices: Error: System error');
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

        describe('selectAudioDeviceInteractively', () => {
            it('should throw error when no logger provided', async () => {
                await expect(selectAudioDeviceInteractively()).rejects.toThrow('Logger is required for interactive device selection');
            });

            it('should return null when no audio devices found', async () => {
                const mockLogger = {
                    debug: vi.fn(),
                    info: vi.fn(),
                    warn: vi.fn(),
                    error: vi.fn()
                };

                const { run } = await import('../src/util/child');

                // Mock parseAudioDevices call with no devices
                vi.mocked(run).mockResolvedValueOnce({
                    code: 1,
                    stdout: '',
                    stderr: 'No audio devices found'
                });

                const result = await selectAudioDeviceInteractively(mockLogger);

                expect(result).toBeNull();
                expect(mockLogger.error).toHaveBeenCalledWith('❌ No audio devices found. Make sure ffmpeg is installed and audio devices are available.');
            });
        });

        describe('selectAndConfigureAudioDevice', () => {
            it('should throw error when no logger provided', async () => {
                await expect(selectAndConfigureAudioDevice('/test/preferences')).rejects.toThrow('Logger is required for audio device selection');
            });
        });
    });

    describe('selectAudioDeviceInteractively - Additional Coverage', () => {
        it('should handle no working devices scenario', async () => {
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            const { run } = await import('../src/util/child');

            // Mock parseAudioDevices call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone
[1] MacBook Pro Microphone`
            });

            // Mock testAudioDevice calls - all devices fail
            vi.mocked(run).mockRejectedValue(new Error('Access denied'));

            const result = await selectAudioDeviceInteractively(mockLogger);

            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith('❌ No working audio devices found. This may be due to:');
            expect(mockLogger.error).toHaveBeenCalledWith('   • Microphone permission not granted to Terminal/iTerm');
            expect(mockLogger.error).toHaveBeenCalledWith('   • Audio devices in use by other applications');
            expect(mockLogger.error).toHaveBeenCalledWith('   • ffmpeg configuration issues');
            expect(mockLogger.error).toHaveBeenCalledWith('');
            expect(mockLogger.error).toHaveBeenCalledWith('💡 Try:');
            expect(mockLogger.error).toHaveBeenCalledWith('   • Go to System Preferences → Security & Privacy → Privacy → Microphone');
            expect(mockLogger.error).toHaveBeenCalledWith('   • Make sure Terminal (or your terminal app) has microphone access');
            expect(mockLogger.error).toHaveBeenCalledWith('   • Close other audio applications and try again');
        });
    });

    describe('findWorkingAudioDevice', () => {
        beforeEach(() => {
            // Clear all mocks before each test in this suite
            vi.clearAllMocks();
        });

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
            vi.mocked(run).mockResolvedValue({
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

        it('should throw AudioDeviceError when no devices are available', async () => {
            const { run } = await import('../src/util/child');

            // Mock parseAudioDevices to return empty array
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: 'No audio devices found'
            });

            await expect(findWorkingAudioDevice()).resolves.toBeNull();
        });

        it('should use logger for debugging device tests', async () => {
            const { run } = await import('../src/util/child');
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            // Mock device list call
            vi.mocked(run).mockResolvedValueOnce({
                code: 1,
                stdout: '',
                stderr: `AVFoundation audio devices:
[0] Built-in Microphone`
            });

            // Mock validation calls
            vi.mocked(run).mockResolvedValue({
                code: 0,
                stdout: '',
                stderr: ''
            });

            await findWorkingAudioDevice(mockLogger);
            expect(mockLogger.debug).toHaveBeenCalledWith('Testing audio device: [0] Built-in Microphone');
        });

        it('should use logger for error reporting', async () => {
            const { run } = await import('../src/util/child');
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            vi.mocked(run).mockRejectedValue(new Error('FFmpeg failed'));

            await findWorkingAudioDevice(mockLogger);
            expect(mockLogger.error).toHaveBeenCalledWith('Error parsing audio devices: Error: FFmpeg failed');
            expect(mockLogger.error).toHaveBeenCalledWith('Error finding working audio device: AudioDeviceError: No audio devices available');
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

        it('should use logger for successful save', async () => {
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            const config = {
                audioDevice: '1',
                audioDeviceName: 'Test Device'
            };
            const preferencesDir = '/test/preferences';

            await saveAudioDeviceConfig(config, preferencesDir, mockLogger);

            expect(mockLogger.debug).toHaveBeenCalledWith('Audio device configuration saved to: /test/preferences/audio-device.json');
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

        it('should use logger for successful load', async () => {
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            const config = {
                audioDevice: '1',
                audioDeviceName: 'Test Device'
            };
            const preferencesDir = '/test/preferences';

            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(config));

            const loadedConfig = await loadAudioDeviceConfig(preferencesDir, mockLogger);

            expect(loadedConfig).toEqual(config);
            expect(mockLogger.debug).toHaveBeenCalledWith('Audio device configuration loaded from: /test/preferences/audio-device.json');
        });

        it('should return null when config file does not exist', async () => {
            const preferencesDir = '/test/preferences';
            const error = new Error('File not found') as any;
            error.code = 'ENOENT';

            vi.mocked(fs.readFile).mockRejectedValue(error);

            const loadedConfig = await loadAudioDeviceConfig(preferencesDir);

            expect(loadedConfig).toBeNull();
        });

        it('should use logger for file not found', async () => {
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            const preferencesDir = '/test/preferences';
            const error = new Error('File not found') as any;
            error.code = 'ENOENT';

            vi.mocked(fs.readFile).mockRejectedValue(error);

            const loadedConfig = await loadAudioDeviceConfig(preferencesDir, mockLogger);

            expect(loadedConfig).toBeNull();
            expect(mockLogger.debug).toHaveBeenCalledWith('No audio device configuration found at: /test/preferences/audio-device.json');
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

    describe('testAudioDevice', () => {
        it('should return true for working audio device', async () => {
            const { run } = await import('../src/util/child');

            vi.mocked(run).mockResolvedValue({
                code: 0, // Success
                stdout: '',
                stderr: ''
            });

            const isWorking = await testAudioDevice('1');
            expect(isWorking).toBe(true);
            expect(run).toHaveBeenCalledWith(
                expect.stringContaining('ffmpeg'),
                ['-f', 'avfoundation', '-i', ':1', '-t', '0.1', '-f', 'null', '-'],
                expect.objectContaining({ timeout: 5000 })
            );
        });

        it('should return false for non-working audio device', async () => {
            const { run } = await import('../src/util/child');

            vi.mocked(run).mockRejectedValue(new Error('Device access failed'));

            const isWorking = await testAudioDevice('1');
            expect(isWorking).toBe(false);
        });

        it('should return false when device test throws error', async () => {
            const { run } = await import('../src/util/child');

            vi.mocked(run).mockRejectedValue(new Error('FFmpeg timeout'));

            const isWorking = await testAudioDevice('1');
            expect(isWorking).toBe(false);
        });

        it('should use logger for debug output', async () => {
            const { run } = await import('../src/util/child');
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            vi.mocked(run).mockResolvedValue({
                code: 0,
                stdout: '',
                stderr: ''
            });

            await testAudioDevice('1', mockLogger);
            expect(mockLogger.debug).toHaveBeenCalledWith('Device 1 test: PASS');
        });

        it('should log failure message on device test failure', async () => {
            const { run } = await import('../src/util/child');
            const mockLogger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };

            const error = new Error('Device not found');
            vi.mocked(run).mockRejectedValue(error);

            await testAudioDevice('1', mockLogger);
            expect(mockLogger.debug).toHaveBeenCalledWith('Device 1 test: FAIL - Device not found');
        });
    });

    describe('getFFmpegPath utility', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('should use environment variable when FFMPEG_PATH is set', async () => {
            process.env.FFMPEG_PATH = '/custom/path/to/ffmpeg';

            // Import the module to get the function
            const devicesModule = await import('../src/devices');

            // We need to test this indirectly through a function that uses getFFmpegPath
            const { run } = await import('../src/util/child');
            vi.mocked(run).mockResolvedValue({
                code: 1,
                stdout: '',
                stderr: 'AVFoundation audio devices:\n[0] Test Device'
            });

            await devicesModule.parseAudioDevices();

            expect(run).toHaveBeenCalledWith(
                '/custom/path/to/ffmpeg',
                expect.any(Array),
                expect.any(Object)
            );
        });

        it('should use default path when FFMPEG_PATH is not set', async () => {
            delete process.env.FFMPEG_PATH;

            const devicesModule = await import('../src/devices');

            const { run } = await import('../src/util/child');
            vi.mocked(run).mockResolvedValue({
                code: 1,
                stdout: '',
                stderr: 'AVFoundation audio devices:\n[0] Test Device'
            });

            await devicesModule.parseAudioDevices();

            expect(run).toHaveBeenCalledWith(
                '/opt/homebrew/bin/ffmpeg',
                expect.any(Array),
                expect.any(Object)
            );
        });
    });

    describe('getFFmpegPath utility - Additional Coverage', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('should handle empty FFMPEG_PATH environment variable', async () => {
            process.env.FFMPEG_PATH = '';

            const devicesModule = await import('../src/devices');

            const { run } = await import('../src/util/child');
            vi.mocked(run).mockResolvedValue({
                code: 1,
                stdout: '',
                stderr: 'AVFoundation audio devices:\n[0] Test Device'
            });

            await devicesModule.parseAudioDevices();

            expect(run).toHaveBeenCalledWith(
                '/opt/homebrew/bin/ffmpeg', // Should use default when empty
                expect.any(Array),
                expect.any(Object)
            );
        });
    });
}); 