/**
 * React-to-HTML renderer.
 *
 * Accepts a JSX/TSX component string and renders it to static HTML by
 * delegating to an isolated child process (`react-render-worker`).
 *
 * Security model: user-controlled component code is executed inside a
 * dedicated subprocess spawned via child_process.fork(). If the inner vm
 * sandbox in the worker is bypassed, the attacker is confined to that
 * subprocess — they cannot access the main API process's heap, secrets,
 * environment variables, or file descriptors. The main process enforces a
 * hard timeout and kills the child if it does not respond in time.
 *
 * Tradeoff vs isolated-vm: child_process.fork() uses real OS process
 * isolation (separate address space, separate file descriptor table) at the
 * cost of ~50–150ms cold-start per render. isolated-vm would be faster and
 * equally secure, but requires native compilation. Migrate to isolated-vm
 * if render latency becomes a concern.
 */

import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { ValidationError } from '../lib/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROCESS_TIMEOUT_MS = 8000; // hard-kill timeout for the child process
const MAX_SOURCE_SIZE = 1_048_576; // 1 MB

interface WorkerMessage {
  type: 'ready' | 'success' | 'error';
  html?: string;
  message?: string;
  isValidation?: boolean;
}

/**
 * Determine the worker script path and any extra Node.js exec args.
 * In development (tsx/ts-node), the source .ts is executed via `--import tsx`.
 * In production, the compiled .js is executed directly.
 */
function getWorkerConfig(): { workerPath: string; execArgv: string[] } {
  const isTsDev = __filename.endsWith('.ts');
  if (isTsDev) {
    return {
      workerPath: join(__dirname, '..', 'workers', 'react-render-worker.ts'),
      execArgv: ['--import', 'tsx'],
    };
  }
  return {
    workerPath: join(__dirname, '..', 'workers', 'react-render-worker.js'),
    execArgv: [],
  };
}

/**
 * Render a React component string to a full HTML document.
 * Executes in an isolated child process with a hard timeout.
 */
export async function renderReactToHtml(
  componentSource: string,
  props: Record<string, unknown> = {},
  styles?: string,
): Promise<string> {
  if (componentSource.length > MAX_SOURCE_SIZE) {
    throw new ValidationError(`React component source exceeds maximum size of ${MAX_SOURCE_SIZE} bytes`);
  }

  return new Promise<string>((resolve, reject) => {
    const { workerPath, execArgv } = getWorkerConfig();

    const child = fork(workerPath, [], {
      execArgv,
      env: {
        // Pass ONLY the minimum env vars needed to run the worker.
        // Deliberately omit DATABASE_URL, REDIS_URL, API keys, secrets, etc.
        NODE_ENV: process.env.NODE_ENV,
      },
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
      detached: false,
    });

    let settled = false;

    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      done(() => {
        child.kill('SIGKILL');
        reject(new ValidationError('React component render timed out'));
      });
    }, PROCESS_TIMEOUT_MS);

    child.on('message', (msg: WorkerMessage) => {
      if (msg.type === 'ready') {
        // Worker is up — send the render request
        child.send({ type: 'render', componentSource, props, styles });
        return;
      }

      if (msg.type === 'success') {
        done(() => {
          child.kill('SIGTERM');
          resolve(msg.html!);
        });
      } else {
        done(() => {
          child.kill('SIGTERM');
          reject(new ValidationError(msg.message || 'Failed to render React component'));
        });
      }
    });

    child.on('error', (err) => {
      done(() => reject(new ValidationError(`Failed to spawn render worker: ${err.message}`)));
    });

    child.on('exit', (code, signal) => {
      done(() => {
        if (signal === 'SIGKILL') {
          reject(new ValidationError('React component render timed out'));
        } else if (signal !== 'SIGTERM') {
          reject(new ValidationError(`Render worker exited unexpectedly (code=${code})`));
        }
      });
    });
  });
}
