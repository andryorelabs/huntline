export type Envelope<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly message: string;
        readonly recoverable: boolean;
        readonly recoveryAction?: string;
      };
    };

export type ExitCode = 0 | 1 | 2 | 3;

const EXIT_CODE_BY_ERROR: Readonly<Record<string, ExitCode>> = {
  "not-implemented": 1,
  "todo-markers": 1,
  "already-exists": 1,
  "unknown-command": 2,
  usage: 2,
  "data-dir-not-found": 2,
  "profile-missing": 2,
  "profile-malformed": 2,
  internal: 3,
};

export function success<T>(data: T): Envelope<T> {
  return { ok: true, data };
}

export function failure(
  code: string,
  message: string,
  options: { recoverable?: boolean; recoveryAction?: string } = {},
): Envelope<never> {
  const base = { code, message, recoverable: options.recoverable ?? true };
  return {
    ok: false,
    error:
      options.recoveryAction === undefined
        ? base
        : { ...base, recoveryAction: options.recoveryAction },
  };
}

export function exitCodeFor(envelope: Envelope<unknown>): ExitCode {
  if (envelope.ok) return 0;
  return EXIT_CODE_BY_ERROR[envelope.error.code] ?? 1;
}

export function printEnvelope(envelope: Envelope<unknown>): void {
  process.stdout.write(`${JSON.stringify(envelope)}\n`);
}
