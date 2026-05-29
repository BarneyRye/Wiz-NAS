import { readdir, stat, statfs } from "node:fs/promises"
import { join, relative, sep } from "node:path"
import { getMimeType } from "@packages/types"
import type { Drive, File } from "@packages/types"
import { db } from "@db/db.ts"
import { insertFile, getFilesByDrive, deleteFile } from "@db/queries"

export async function scanDriveBytes(id: number, drives: Drive[]): Promise<{
    total_bytes: number,
    used_bytes: number,
}> {
    const drive = drives.find(d => d.id === id);
    if (!drive) throw new Error(`Drive ${id} not found`);

    const stats = await statfs(drive.path);
    const total_bytes = stats.blocks * stats.bsize;
    const used_bytes = (stats.blocks - stats.bfree) * stats.bsize;

    return { total_bytes, used_bytes };
}

export async function scanDriveFiles(id: number, drives: Drive[]): Promise<File[]> {
    const drive = drives.find(d => d.id === id);
    if (!drive) throw new Error(`Drive ${id} not found`);

    const driveId = drive.id;
    const drivePath = drive.path;
    const existing = getFilesByDrive.all(driveId);
    const known = new Set(existing.map(f => f.path));
    const seen = new Set<string>();
    const toInsert: { name: string; path: string; size: number }[] = [];

    async function walk(dir: string): Promise<void> {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            } else if (entry.isFile()) {
                const relPath = relative(drivePath, fullPath).split(sep).join('/');
                seen.add(relPath);
                if (!known.has(relPath)) {
                    const { size } = await stat(fullPath);
                    toInsert.push({ name: entry.name, path: relPath, size });
                }
            }
        }
    }

    await walk(drive.path);

    const sync = db.transaction(() => {
        const added: File[] = [];
        for (const f of toInsert) {
            const file = insertFile.get(driveId, f.name, f.path, f.size, getMimeType(f.name));
            if (file) added.push(file);
        }
        for (const file of existing) {
            if (!seen.has(file.path)) deleteFile.run(file.id);
        }
        return added;
    });

    return sync();
}
