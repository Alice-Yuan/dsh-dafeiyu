import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PilotError } from '../pilot/contracts.js';

export interface Credential { uid: string; sessdata: string; csrf: string; buvid3: string }
export interface Vault { read(): Promise<Credential | null>; write(value: Credential): Promise<void>; remove(): Promise<void> }
export function credentialOf(value: unknown): Credential {
  if (!value || typeof value !== 'object') throw new PilotError('INVALID_CREDENTIAL');
  const c = value as Credential;
  if (!/^[1-9]\d{0,24}$/.test(c.uid) || ![c.sessdata, c.csrf, c.buvid3].every(v => typeof v === 'string' && v.length > 0 && v.length < 4096 && !/[\r\n;]/.test(v))) throw new PilotError('INVALID_CREDENTIAL');
  return { uid: c.uid, sessdata: c.sessdata, csrf: c.csrf, buvid3: c.buvid3 };
}
// Fixed code only. Sensitive input travels over stdin, never argv/environment/files/logs.
const PS = `Add-Type -AssemblyName System.Security
$ErrorActionPreference='Stop'
try {
  $inputValue=[Console]::In.ReadToEnd() | ConvertFrom-Json
  $bytes=[Convert]::FromBase64String($inputValue.data)
  $scope=[System.Security.Cryptography.DataProtectionScope]::CurrentUser
  if($inputValue.operation -eq 'protect') { $result=[System.Security.Cryptography.ProtectedData]::Protect($bytes,$null,$scope) }
  elseif($inputValue.operation -eq 'unprotect') { $result=[System.Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,$scope) }
  else { exit 2 }
  [Console]::Out.Write([Convert]::ToBase64String($result))
} catch { exit 3 }`;
export function dpapi(operation: 'protect' | 'unprotect', bytes: Buffer): Promise<Buffer> {
  if (process.platform !== 'win32') return Promise.reject(new PilotError('SECURE_STORAGE_UNAVAILABLE'));
  const exe = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return new Promise((resolve, reject) => {
    const child = spawn(exe, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(PS, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    let output = ''; let failed = false;
    const timer = setTimeout(() => { failed = true; child.kill(); }, 10_000);
    child.stdout.on('data', (data: Buffer) => { output += data.toString('ascii'); if (output.length > 65_536) { failed = true; child.kill(); } });
    child.stdin.on('error', () => { failed = true; });
    child.on('error', () => { clearTimeout(timer); reject(new PilotError('SECURE_STORAGE_UNAVAILABLE')); });
    child.on('close', code => { clearTimeout(timer); if (code !== 0 || failed || !/^[A-Za-z0-9+/]+={0,2}$/.test(output)) reject(new PilotError('SECURE_STORAGE_FAILED')); else resolve(Buffer.from(output, 'base64')); });
    child.stdin.end(JSON.stringify({ operation, data: bytes.toString('base64') }));
  });
}
export class WindowsVault implements Vault {
  constructor(private readonly path: string) {}
  async read(): Promise<Credential | null> {
    let ciphertext: Buffer;
    try { ciphertext = await readFile(this.path); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw new PilotError('SECURE_STORAGE_FAILED'); }
    const plain = await dpapi('unprotect', ciphertext);
    try { return credentialOf(JSON.parse(plain.toString('utf8'))); } catch { throw new PilotError('SECURE_STORAGE_FAILED'); }
    finally { plain.fill(0); }
  }
  async write(value: Credential): Promise<void> {
    const plain = Buffer.from(JSON.stringify(credentialOf(value)), 'utf8');
    let cipher: Buffer;
    try { cipher = await dpapi('protect', plain); } finally { plain.fill(0); }
    await mkdir(dirname(this.path), { recursive: true });
    const temp = this.path + '.' + randomUUID() + '.tmp';
    try { await writeFile(temp, cipher, { mode: 0o600, flag: 'wx' }); await rename(temp, this.path); }
    catch { await unlink(temp).catch(() => {}); throw new PilotError('SECURE_STORAGE_FAILED'); }
  }
  async remove(): Promise<void> { await unlink(this.path).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new PilotError('SECURE_STORAGE_FAILED'); }); }
}
