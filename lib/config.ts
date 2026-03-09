// Vault registry — stores vault metadata in ~/.md-cli/vaults.json (or XDG on Linux).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

function load(): VaultConfig[] {
  const p = vaultsPath();
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return [];
  }
}

function save(vaults: VaultConfig[]): void {
  const dir = configDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(vaultsPath(), JSON.stringify(vaults, null, 2), { mode: 0o600 });
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
  return resolve(optPath || ".");
}
