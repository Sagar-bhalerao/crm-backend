import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

/**
 * Files live on disk under STORAGE_PATH; the database stores the relative
 * path only ("quotations/2026/09/QT-DNBMUM1-v2.pdf"), so moving or
 * redeploying the folder does not invalidate every row.
 */
const root = path.resolve(env.storagePath);

/** quotations/2026/09/QT-DNBMUM1-v2.pdf */
export function buildPath(folder, fileName, date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return path.posix.join(folder, year, month, fileName);
}

/** Turns a stored relative path into a full path on this machine. */
export function absolutePath(relativePath) {
  const full = path.resolve(root, relativePath);
  // A stored value containing ".." must never reach outside the storage folder
  if (!full.startsWith(root)) throw new Error("Invalid storage path");
  return full;
}

/** Writes the file, creating the year and month folders as needed. */
export async function saveFile(relativePath, buffer) {
  const full = absolutePath(relativePath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
  return relativePath;
}

export async function readFile(relativePath) {
  return fs.readFile(absolutePath(relativePath));
}

export async function fileExists(relativePath) {
  try {
    await fs.access(absolutePath(relativePath));
    return true;
  } catch {
    return false;
  }
}

/** Deleting is best-effort: a missing file is not an error. */
export async function deleteFile(relativePath) {
  try {
    await fs.unlink(absolutePath(relativePath));
    return true;
  } catch {
    return false;
  }
}