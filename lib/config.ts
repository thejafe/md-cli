// Vault registry — stores vault metadata in ~/.md-cli/vaults.json (or XDG on Linux).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { homedir, platform } from "node:os";
import { randomUUID } from "node:crypto";

const APP_NAME = "md-cli";

export interface VaultConfig {
  id: string;
  name: string;
  path: string;
  configDir: string;
  dailyFolder: string;
  attachmentFolder: string;
  trashOption: "local" | "system" | "permanent";
  createdAt: string;
}

export type VaultUpdateOpts = Partial<
  Pick<VaultConfig, "name" | "configDir" | "dailyFolder" | "attachmentFolder" | "trashOption">
>;

function configDir(): string {
  if (platform() === "linux") {
    const xdg = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
    return join(xdg, APP_NAME);
  }
  return join(homedir(), `.${APP_NAME}`);
}

function vaultsPath(): string {
  return join(configDir(), "vaults.json");
}

let _cache: VaultConfig[] | null = null;

function load(): VaultConfig[] {
  if (_cache) return _cache;
  const p = vaultsPath();
  if (!existsSync(p)) return (_cache = []);
  try {
    return (_cache = JSON.parse(readFileSync(p, "utf-8")));
  } catch {
    console.warn(`Warning: ${p} is corrupt or unreadable — vault registry reset.`);
    return (_cache = []);
  }
}

function save(vaults: VaultConfig[]): void {
  _cache = vaults;
  const dir = configDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const target = vaultsPath();
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, JSON.stringify(vaults, null, 2), { mode: 0o600 });
  renameSync(tmp, target);
}

export function registerVault(vaultPath: string, opts: VaultUpdateOpts = {}): VaultConfig {
  const abs = resolve(vaultPath);
  const vaults = load();
  let vault = vaults.find((v) => resolve(v.path) === abs);

  if (vault) {
    if (opts.name !== undefined) vault.name = opts.name;
    if (opts.configDir !== undefined) vault.configDir = opts.configDir;
    if (opts.dailyFolder !== undefined) vault.dailyFolder = opts.dailyFolder;
    if (opts.attachmentFolder !== undefined) vault.attachmentFolder = opts.attachmentFolder;
    if (opts.trashOption !== undefined) vault.trashOption = opts.trashOption;
  } else {
    vault = {
      id: randomUUID(),
      name: opts.name || basename(abs),
      path: abs,
      configDir: opts.configDir || ".obsidian",
      dailyFolder: opts.dailyFolder || "",
      attachmentFolder: opts.attachmentFolder || "",
      trashOption: opts.trashOption || "local",
      createdAt: new Date().toISOString(),
    };
    vaults.push(vault);
  }

  save(vaults);
  return vault;
}

export function findVault(vaultPath: string): VaultConfig | null {
  const abs = resolve(vaultPath);
  return load().find((v) => resolve(v.path) === abs) ?? null;
}

export function listVaults(): VaultConfig[] {
  return load();
}

export function unregisterVault(vaultPath: string): boolean {
  const abs = resolve(vaultPath);
  const vaults = load();
  const filtered = vaults.filter((v) => resolve(v.path) !== abs);
  if (filtered.length === vaults.length) return false;
  save(filtered);
  return true;
}

export function resolveVaultPath(optPath?: string): string {
  if (optPath) return resolve(optPath);

  // Check if CWD is inside a registered vault
  const cwd = resolve(".");
  const vaults = load();
  for (const v of vaults) {
    const vp = resolve(v.path);
    if (cwd === vp || cwd.startsWith(vp + "/")) return vp;
  }

  // If exactly one vault is registered, use it
  if (vaults.length === 1) return resolve(vaults[0].path);

  return cwd;
}
