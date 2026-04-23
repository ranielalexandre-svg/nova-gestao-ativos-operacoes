import { existsSync, readdirSync } from "fs";
import { createRequire } from "module";
import { join } from "path";

const requireHere = createRequire(__filename);
const moduleCache = new Map<string, unknown>();

function nodeModuleRoots() {
  const candidates = new Set<string>();

  if (process.env.CODEX_RUNTIME_NODE_MODULES) {
    candidates.add(process.env.CODEX_RUNTIME_NODE_MODULES);
  }

  if (process.env.NODE_PATH) {
    for (const item of process.env.NODE_PATH.split(":").map((entry) => entry.trim()).filter(Boolean)) {
      candidates.add(item);
    }
  }

  candidates.add(join(process.env.HOME || "", ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules"));

  const windowsUsersRoot = "/mnt/c/Users";
  if (existsSync(windowsUsersRoot)) {
    for (const entry of readdirSync(windowsUsersRoot)) {
      candidates.add(join(windowsUsersRoot, entry, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules"));
    }
  }

  return [...candidates].filter((candidate) => candidate && existsSync(candidate));
}

export function requireRuntimeModule<T = unknown>(moduleName: string): T {
  if (moduleCache.has(moduleName)) {
    return moduleCache.get(moduleName) as T;
  }

  try {
    const local = requireHere(moduleName) as T;
    moduleCache.set(moduleName, local);
    return local;
  } catch {}

  for (const root of nodeModuleRoots()) {
    const candidate = join(root, moduleName);
    if (!existsSync(candidate)) {
      continue;
    }

    const resolved = requireHere(candidate) as T;
    moduleCache.set(moduleName, resolved);
    return resolved;
  }

  throw new Error(`Módulo de runtime indisponível: ${moduleName}`);
}
