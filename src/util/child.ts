import { spawn, SpawnOptions } from 'child_process';

import { Logger } from '../types';

/**
 * Result of a child process execution
 */
export interface ChildProcessResult {
    code: number;
    stdout: string;
    stderr: string;
    signal?: string;
}

/**
 * Options for running child processes
 */
export interface RunOptions {
    /** Working directory for the process */
    cwd?: string;
    /** Environment variables */
    env?: Record<string, string>;
    /** Timeout in milliseconds */
    timeout?: number;
    /** Logger for debugging */
    logger?: Logger;
    /** Input to send to the process */
    input?: string;
    /** Whether to capture stderr separately */
    captureStderr?: boolean;
}

/**
 * Execute a command with arguments and return the result
 * @param command The command to execute
 * @param args Arguments for the command
 * @param options Execution options
 * @returns Promise resolving to execution result
 */
export const run = (
    command: string,
    args: string[] = [],
    options: RunOptions = {}
): Promise<ChildProcessResult> => {
    return new Promise((resolve, reject) => {
        const {
            cwd,
            env = process.env,
            timeout = 30000,
            logger,
            input,
            captureStderr = true
        } = options;

        logger?.debug(`Executing: ${command} ${args.join(' ')}`);

        const spawnOptions: SpawnOptions = {
            cwd,
            env,
            stdio: ['pipe', 'pipe', captureStderr ? 'pipe' : 'inherit']
        };

        const child = spawn(command, args, spawnOptions);

        let stdout = '';
        let stderr = '';
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        // Set up timeout
        if (timeout > 0) {
            timeoutId = setTimeout(() => {
                logger?.debug(`Process timed out after ${timeout}ms, killing...`);
                child.kill('SIGTERM');

                // Force kill after additional delay
                setTimeout(() => {
                    if (!child.killed) {
                        child.kill('SIGKILL');
                    }
                }, 5000);
            }, timeout);
        }

        // Handle stdout
        if (child.stdout) {
            child.stdout.on('data', (data: Buffer) => {
                const text = data.toString();
                stdout += text;
                logger?.debug(`stdout: ${text.trim()}`);
            });
        }

        // Handle stderr
        if (child.stderr && captureStderr) {
            child.stderr.on('data', (data: Buffer) => {
                const text = data.toString();
                stderr += text;
                logger?.debug(`stderr: ${text.trim()}`);
            });
        }

        // Send input if provided
        if (input && child.stdin) {
            child.stdin.write(input);
            child.stdin.end();
        }

        // Handle process completion
        child.on('close', (code, signal) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            logger?.debug(`Process exited with code ${code}, signal ${signal}`);

            const result: ChildProcessResult = {
                code: code || 0,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                signal: signal || undefined
            };

            resolve(result);
        });

        // Handle process errors
        child.on('error', (error) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            logger?.error(`Process error: ${error.message}`);
            reject(new Error(`Failed to execute ${command}: ${error.message}`));
        });
    });
};

/**
 * Simple wrapper for running commands and getting stdout
 * @param command Command string with arguments
 * @param options Execution options
 * @returns Promise resolving to stdout string
 */
export const exec = async (command: string, options: RunOptions = {}): Promise<string> => {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    const result = await run(cmd, args, options);

    if (result.code !== 0) {
        throw new Error(`Command failed with code ${result.code}: ${result.stderr || result.stdout}`);
    }

    return result.stdout;
}; 