import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { run, exec } from '../../src/util/child';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process', () => ({
    spawn: vi.fn()
}));

// Import the mocked spawn function
import { spawn } from 'child_process';
const mockSpawn = vi.mocked(spawn);

// Create a mock child process
const createMockChild = () => {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = {
        write: vi.fn(),
        end: vi.fn()
    };
    child.kill = vi.fn();
    child.killed = false;
    return child;
};

describe('child.ts - run function', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.clearAllTimers();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    test('should execute command successfully and return stdout and stderr', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = run('echo', ['hello world']);

        // Simulate process output
        mockChild.stdout.emit('data', Buffer.from('hello world\n'));
        mockChild.stderr.emit('data', Buffer.from(''));
        mockChild.emit('close', 0, null);

        const result = await promise;

        expect(mockSpawn).toHaveBeenCalledWith('echo', ['hello world'], {
            cwd: undefined,
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        expect(result).toEqual({
            code: 0,
            stdout: 'hello world',
            stderr: '',
            signal: undefined
        });
    });

    test('should execute command with custom options', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const options = {
            cwd: '/custom/directory',
            env: { NODE_ENV: 'test' },
            timeout: 5000
        };

        const promise = run('npm', ['--version'], options);

        // Simulate process output
        mockChild.stdout.emit('data', Buffer.from('8.19.2\n'));
        mockChild.emit('close', 0, null);

        const result = await promise;

        expect(mockSpawn).toHaveBeenCalledWith('npm', ['--version'], {
            cwd: '/custom/directory',
            env: { NODE_ENV: 'test' },
            stdio: ['pipe', 'pipe', 'pipe']
        });
        expect(result).toEqual({
            code: 0,
            stdout: '8.19.2',
            stderr: '',
            signal: undefined
        });
    });

    test('should handle commands that produce stderr output', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = run('some-command');

        // Simulate stderr output
        mockChild.stdout.emit('data', Buffer.from(''));
        mockChild.stderr.emit('data', Buffer.from('Warning: deprecated feature used\n'));
        mockChild.emit('close', 0, null);

        const result = await promise;

        expect(result).toEqual({
            code: 0,
            stdout: '',
            stderr: 'Warning: deprecated feature used',
            signal: undefined
        });
    });

    test('should handle commands that produce both stdout and stderr', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = run('command-with-mixed-output');

        // Simulate mixed output
        mockChild.stdout.emit('data', Buffer.from('Success message\n'));
        mockChild.stderr.emit('data', Buffer.from('Warning message\n'));
        mockChild.emit('close', 0, null);

        const result = await promise;

        expect(result).toEqual({
            code: 0,
            stdout: 'Success message',
            stderr: 'Warning message',
            signal: undefined
        });
    });

    test('should reject when command execution fails', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = run('invalid-command');

        // Simulate process error
        mockChild.emit('error', new Error('spawn invalid-command ENOENT'));

        await expect(promise).rejects.toThrow('Failed to execute invalid-command: spawn invalid-command ENOENT');
    });

    test('should handle command with exit code error', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = run('failing-command');

        // Simulate process failure
        mockChild.stdout.emit('data', Buffer.from(''));
        mockChild.stderr.emit('data', Buffer.from('Command failed\n'));
        mockChild.emit('close', 1, null);

        const result = await promise;

        expect(result).toEqual({
            code: 1,
            stdout: '',
            stderr: 'Command failed',
            signal: undefined
        });
    });

    test('should handle timeout errors', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = run('long-running-command', [], { timeout: 1000 });

        // Advance timers to trigger timeout
        vi.advanceTimersByTime(1000);

        // Simulate process close after timeout
        mockChild.emit('close', null, 'SIGTERM');

        const result = await promise;

        expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
        expect(result).toEqual({
            code: 0,
            stdout: '',
            stderr: '',
            signal: 'SIGTERM'
        });
    });

    test('should handle empty command string', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = run('');

        mockChild.emit('close', 0, null);

        const result = await promise;

        expect(mockSpawn).toHaveBeenCalledWith('', [], {
            cwd: undefined,
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        expect(result).toEqual({
            code: 0,
            stdout: '',
            stderr: '',
            signal: undefined
        });
    });

    test('should handle commands with special characters', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const command = 'echo';
        const args = ['Hello & goodbye; echo $HOME | grep user'];

        const promise = run(command, args);

        mockChild.stdout.emit('data', Buffer.from('Hello & goodbye; echo $HOME | grep user\n'));
        mockChild.emit('close', 0, null);

        const result = await promise;

        expect(mockSpawn).toHaveBeenCalledWith(command, args, {
            cwd: undefined,
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        expect(result.stdout).toBe('Hello & goodbye; echo $HOME | grep user');
    });

    test('should handle large output', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = run('command-with-large-output');

        const largeOutput = 'x'.repeat(10000);
        mockChild.stdout.emit('data', Buffer.from(largeOutput));
        mockChild.emit('close', 0, null);

        const result = await promise;

        expect(result.stdout).toBe(largeOutput);
        expect(result.stdout.length).toBe(10000);
    });

    test('should handle unicode characters in output', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = run('echo', ['unicode test']);

        const unicodeOutput = '🚀 Deployment successful! 中文测试 émojis 🎉';
        mockChild.stdout.emit('data', Buffer.from(unicodeOutput));
        mockChild.emit('close', 0, null);

        const result = await promise;

        expect(result.stdout).toBe(unicodeOutput);
    });

    test('should handle multiple consecutive calls', async () => {
        const mockChild1 = createMockChild();
        const mockChild2 = createMockChild();
        const mockChild3 = createMockChild();

        mockSpawn
            .mockReturnValueOnce(mockChild1)
            .mockReturnValueOnce(mockChild2)
            .mockReturnValueOnce(mockChild3);

        const promise1 = run('command1');
        const promise2 = run('command2');
        const promise3 = run('command3');

        // Simulate outputs
        mockChild1.stdout.emit('data', Buffer.from('First command'));
        mockChild1.emit('close', 0, null);

        mockChild2.stdout.emit('data', Buffer.from('Second command'));
        mockChild2.emit('close', 0, null);

        mockChild3.stdout.emit('data', Buffer.from('Third command'));
        mockChild3.emit('close', 0, null);

        const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

        expect(result1.stdout).toBe('First command');
        expect(result2.stdout).toBe('Second command');
        expect(result3.stdout).toBe('Third command');
        expect(mockSpawn).toHaveBeenCalledTimes(3);
    });

    test('should preserve options object immutability', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const options = {
            cwd: '/test',
            env: { TEST: 'value' }
        };
        const originalOptions = { ...options };

        const promise = run('test-command', [], options);

        mockChild.emit('close', 0, null);
        await promise;

        expect(options).toEqual(originalOptions);
    });

    test('should handle input to stdin', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = run('command', [], { input: 'test input' });

        mockChild.emit('close', 0, null);
        await promise;

        expect(mockChild.stdin.write).toHaveBeenCalledWith('test input');
        expect(mockChild.stdin.end).toHaveBeenCalled();
    });

    test('should handle process signals', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = run('interruptible-command');

        mockChild.emit('close', null, 'SIGINT');

        const result = await promise;

        expect(result).toEqual({
            code: 0,
            stdout: '',
            stderr: '',
            signal: 'SIGINT'
        });
    });

    test('should handle commands with environment variables', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const options = {
            env: {
                ...process.env,
                NODE_ENV: 'test',
                DEBUG: 'true'
            }
        };

        const promise = run('env-command', [], options);

        mockChild.emit('close', 0, null);
        await promise;

        expect(mockSpawn).toHaveBeenCalledWith('env-command', [], {
            cwd: undefined,
            env: options.env,
            stdio: ['pipe', 'pipe', 'pipe']
        });
    });

    test('should handle cwd option', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const options = {
            cwd: '/custom/working/directory'
        };

        const promise = run('pwd', [], options);

        mockChild.stdout.emit('data', Buffer.from('/custom/working/directory\n'));
        mockChild.emit('close', 0, null);

        const result = await promise;

        expect(mockSpawn).toHaveBeenCalledWith('pwd', [], {
            cwd: '/custom/working/directory',
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        expect(result.stdout).toBe('/custom/working/directory');
    });

    test('should handle captureStderr option', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = run('command', [], { captureStderr: false });

        mockChild.stdout.emit('data', Buffer.from('output'));
        mockChild.emit('close', 0, null);

        await promise;

        expect(mockSpawn).toHaveBeenCalledWith('command', [], {
            cwd: undefined,
            env: process.env,
            stdio: ['pipe', 'pipe', 'inherit']
        });
    });

    test('should handle timeout with force kill', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = run('long-command', [], { timeout: 1000 });

        // Advance to timeout
        vi.advanceTimersByTime(1000);

        // Simulate child not being killed after SIGTERM
        mockChild.killed = false;

        // Advance to force kill timeout
        vi.advanceTimersByTime(5000);

        mockChild.emit('close', null, 'SIGKILL');

        await promise;

        expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
        expect(mockChild.kill).toHaveBeenCalledWith('SIGKILL');
    });

    test('should handle missing stdout stream', async () => {
        const mockChild = createMockChild();
        mockChild.stdout = null; // Simulate missing stdout
        mockSpawn.mockReturnValue(mockChild);

        const promise = run('command');

        mockChild.emit('close', 0, null);

        const result = await promise;

        expect(result.stdout).toBe('');
    });

    test('should handle missing stderr stream', async () => {
        const mockChild = createMockChild();
        mockChild.stderr = null; // Simulate missing stderr
        mockSpawn.mockReturnValue(mockChild);

        const promise = run('command', [], { captureStderr: true });

        mockChild.emit('close', 0, null);

        const result = await promise;

        expect(result.stderr).toBe('');
    });

    test('should handle missing stdin stream', async () => {
        const mockChild = createMockChild();
        mockChild.stdin = null; // Simulate missing stdin
        mockSpawn.mockReturnValue(mockChild);

        const promise = run('command', [], { input: 'test input' });

        mockChild.emit('close', 0, null);

        await promise; // Should not throw error
    });
});

describe('child.ts - exec function', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.clearAllTimers();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    test('should execute simple command successfully', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = exec('echo hello');

        mockChild.stdout.emit('data', Buffer.from('hello\n'));
        mockChild.emit('close', 0, null);

        const result = await promise;

        expect(mockSpawn).toHaveBeenCalledWith('echo', ['hello'], {
            cwd: undefined,
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        expect(result).toBe('hello');
    });

    test('should execute command with multiple arguments', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = exec('git status --porcelain');

        mockChild.stdout.emit('data', Buffer.from('M  file.txt\n'));
        mockChild.emit('close', 0, null);

        const result = await promise;

        expect(mockSpawn).toHaveBeenCalledWith('git', ['status', '--porcelain'], {
            cwd: undefined,
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        expect(result).toBe('M  file.txt');
    });

    test('should throw error when command fails', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = exec('failing-command');

        mockChild.stderr.emit('data', Buffer.from('Command failed\n'));
        mockChild.emit('close', 1, null);

        await expect(promise).rejects.toThrow('Command failed with code 1: Command failed');
    });

    test('should throw error when command has no stdout but stderr', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const promise = exec('error-command');

        mockChild.stdout.emit('data', Buffer.from(''));
        mockChild.stderr.emit('data', Buffer.from('Error message\n'));
        mockChild.emit('close', 1, null);

        await expect(promise).rejects.toThrow('Command failed with code 1: Error message');
    });

    test('should pass through options to run function', async () => {
        const mockChild = createMockChild();
        mockSpawn.mockReturnValue(mockChild);

        const options = {
            cwd: '/custom/dir',
            timeout: 5000
        };

        const promise = exec('pwd', options);

        mockChild.stdout.emit('data', Buffer.from('/custom/dir\n'));
        mockChild.emit('close', 0, null);

        const result = await promise;

        expect(mockSpawn).toHaveBeenCalledWith('pwd', [], {
            cwd: '/custom/dir',
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        expect(result).toBe('/custom/dir');
    });
}); 