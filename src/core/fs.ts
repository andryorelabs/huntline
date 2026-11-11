import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { errnoCode, isObject } from "./narrow.ts";

const LOCK_DIRECTORY_NAME = ".jobship.lock";
const HOLDERLESS_GRACE_MS = 10_000;
const LOCK_TIMEOUT_MS = 15_000;
const LOCK_POLL_MS = 20;

type LockHolder = { readonly pid: number; readonly acquiredAt: number };

export function writeAtomic(target: string, data: string): void {
  mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, data);
    renameSync(temporary, target);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errnoCode(error) !== "ESRCH";
  }
}

function readHolder(lockPath: string): LockHolder | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path.join(lockPath, "holder.json"), "utf8"));
    if (!isObject(parsed)) return undefined;
    const { pid, acquiredAt } = parsed;
    if (typeof pid !== "number" || typeof acquiredAt !== "number") return undefined;
    return { pid, acquiredAt };
  } catch {
    return undefined;
  }
}

function lockAgeMs(lockPath: string): number {
  try {
    return Date.now() - statSync(lockPath).mtimeMs;
  } catch {
    return Infinity;
  }
}

function isStale(lockPath: string): boolean {
  const holder = readHolder(lockPath);
  if (holder === undefined) return lockAgeMs(lockPath) > HOLDERLESS_GRACE_MS;
  return !isProcessAlive(holder.pid);
}

function tryAcquire(lockPath: string): boolean {
  const staging = mkdtempSync(`${lockPath}.staging-`);
  try {
    const holder: LockHolder = { pid: process.pid, acquiredAt: Date.now() };
    writeFileSync(path.join(staging, "holder.json"), JSON.stringify(holder));
    renameSync(staging, lockPath);
    return true;
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    const code = errnoCode(error);
    if (code === "EEXIST" || code === "ENOTEMPTY") return false;
    throw error;
  }
}

function release(lockPath: string): void {
  const trash = `${lockPath}.released-${process.pid}-${randomUUID()}`;
  try {
    renameSync(lockPath, trash);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return;
    throw error;
  }
  rmSync(trash, { recursive: true, force: true });
}

function reclaimStale(lockPath: string): void {
  const guard = `${lockPath}.reclaim`;
  try {
    mkdirSync(guard);
  } catch (error) {
    if (errnoCode(error) !== "EEXIST") throw error;
    if (lockAgeMs(guard) > HOLDERLESS_GRACE_MS) rmSync(guard, { recursive: true, force: true });
    return;
  }
  try {
    if (existsSync(lockPath) && isStale(lockPath)) release(lockPath);
  } finally {
    rmSync(guard, { recursive: true, force: true });
  }
}

async function acquire(lockPath: string, deadline: number): Promise<void> {
  if (tryAcquire(lockPath)) return;
  if (existsSync(lockPath) && isStale(lockPath)) {
    reclaimStale(lockPath);
    return acquire(lockPath, deadline);
  }
  if (Date.now() >= deadline) {
    throw new Error(`timed out after ${LOCK_TIMEOUT_MS}ms waiting for the lock at ${lockPath}`);
  }
  await Bun.sleep(LOCK_POLL_MS);
  return acquire(lockPath, deadline);
}

export async function withLock<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  mkdirSync(dir, { recursive: true });
  const lockPath = path.join(dir, LOCK_DIRECTORY_NAME);
  await acquire(lockPath, Date.now() + LOCK_TIMEOUT_MS);
  try {
    return await fn();
  } finally {
    release(lockPath);
  }
}
