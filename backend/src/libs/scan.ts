import { readdir, stat, statfs } from "node:fs/promises"
import { join, relative, sep } from "node:path"
import { getMimeType } from "@packages/types"
import type { Drive, File } from "@packages/types"
import { db } from "@db/db.ts"
import { insertFile, getFilesByDrive, deleteFile, updateFileSize, getDrives, updateDriveUsage } from "@db/queries"
import { NotFoundError } from "./errors"

export async function scanDriveBytes(id: number, drives: Drive[]): Promise<{
    total_bytes: number,
    used_bytes: number,
}> {
    const drive = drives.find(d => d.id === id);
    if (!drive) throw new NotFoundError(`Drive ${id} not found`);

    const stats = await statfs(drive.path);
    const total_bytes = stats.blocks * stats.bsize;
    const used_bytes = (stats.blocks - stats.bfree) * stats.bsize;

    return { total_bytes, used_bytes };
}

export async function scanDriveFiles(id: number, drives: Drive[]): Promise<File[]> {
    const drive = drives.find(d => d.id === id);
    if (!drive) throw new NotFoundError(`Drive ${id} not found`);

    const driveId = drive.id;
    const drivePath = drive.path;
    const existing = getFilesByDrive.all(driveId);
    const existingByPath = new Map(existing.map(f => [f.path, f]));
    const seen = new Set<string>();
    const toInsert: { name: string; path: string; size: number }[] = [];
    const toUpdate: { name: string; path: string; size: number }[] = [];

    async function walk(dir: string): Promise<void> {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            } else if (entry.isFile()) {
                const relPath = relative(drivePath, fullPath).split(sep).join('/');
                seen.add(relPath);
                const { size } = await stat(fullPath);
                const current = existingByPath.get(relPath);
                if (!current) {
                    toInsert.push({ name: entry.name, path: relPath, size });
                } else if (current.size_bytes !== size) {
                    toUpdate.push({ name: entry.name, path: relPath, size });
                }
            }
        }
    }

    await walk(drivePath);

    const sync = db.transaction(() => {
        const added: File[] = [];
        for (const f of toInsert) {
            const file = insertFile.get(driveId, f.name, f.path, f.size, getMimeType(f.name));
            if (file) added.push(file);
        }
        for (const f of toUpdate) {
            updateFileSize.run(f.size, getMimeType(f.name), driveId, f.path);
        }
        for (const file of existing) {
            if (!seen.has(file.path)) deleteFile.run(file.id);
        }
        return added;
    });

    return sync();
}

export async function refreshDriveBytesFn(id: number): Promise<Drive> {
    const drives = getDrives.all();
    const drive = drives.find(d => d.id === id);
    if (!drive) throw new NotFoundError(`Drive ${id} not found`);
    const { total_bytes, used_bytes } = await scanDriveBytes(id, drives);
    updateDriveUsage.run(total_bytes, used_bytes, id);
    return { ...drive, total_bytes, used_bytes };
}

export async function refreshAllBytesFn(): Promise<Drive[]> {
    const drives = getDrives.all();
    const result: Drive[] = [];
    for (const drive of drives) {
        const { total_bytes, used_bytes } = await scanDriveBytes(drive.id, drives);
        updateDriveUsage.run(total_bytes, used_bytes, drive.id);
        result.push({ ...drive, total_bytes, used_bytes });
    }
    return result;
}

export async function rescanDriveFn(id: number): Promise<Drive> {
    const drives = getDrives.all();
    const drive = drives.find(d => d.id === id);
    if (!drive) throw new NotFoundError(`Drive ${id} not found`);
    const { total_bytes, used_bytes } = await scanDriveBytes(id, drives);
    updateDriveUsage.run(total_bytes, used_bytes, id);
    await scanDriveFiles(id, drives);
    return { ...drive, total_bytes, used_bytes };
}

export async function rescanAllDrivesFn(): Promise<Drive[]> {
    const drives = getDrives.all();
    const result: Drive[] = [];
    for (const drive of drives) {
        const { total_bytes, used_bytes } = await scanDriveBytes(drive.id, drives);
        updateDriveUsage.run(total_bytes, used_bytes, drive.id);
        await scanDriveFiles(drive.id, drives);
        result.push({ ...drive, total_bytes, used_bytes });
    }
    return result;
}
