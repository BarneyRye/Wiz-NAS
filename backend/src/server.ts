import type { Drive } from '@packages/types'
import { getDrives, insertDrive, updateDriveUsage, deleteDrive } from '@db/queries'
import { scanDriveBytes, scanDriveFiles } from './libs/scan';
import { deleteFileFn } from './libs/files';
import { getFilesByPath } from '@db/queries';

const TRASH_RETENTION_MS = (Number(process.env.TRASH_RETENTION_DAYS) || 30) * 24 * 60 * 60 * 1000;

const drives = await constructDrives();

async function constructDrives(): Promise<Drive[]> {
    const numDrives = Number(process.env.NUM_DRIVES);
    if (!numDrives) throw new Error('Drive number not set in .env');

    const existing = new Map(getDrives.all().map(d => [d.path, d]));
    const drives: Drive[] = [];
    const configuredPaths = new Set<string>();

    for (let i = 0; i < numDrives; i++) {
        const driveName = `DRIVE:${i}:NAME`;
        const drivePath = `DRIVE:${i}:PATH`;
        const name = process.env[driveName];
        const path = process.env[drivePath];
        if (!name || !path) throw new Error(`Drive ${i} configuration incomplete in .env`);
        configuredPaths.add(path);
        const drive = existing.get(path) ?? insertDrive.get(name, path);
        if (!drive) throw new Error(`Failed to register drive ${i}`);
        drives.push(drive);
    }

    for (const [path, drive] of existing) {
        if (!configuredPaths.has(path)) deleteDrive.run(drive.id);
    }

    for (const drive of drives) {
        const { total_bytes, used_bytes } = await scanDriveBytes(drive.id, drives);
        updateDriveUsage.run(total_bytes, used_bytes, drive.id);
        drive.total_bytes = total_bytes;
        drive.used_bytes = used_bytes;

        await scanDriveFiles(drive.id, drives);
    }

    return drives;
}

const trashCleanup = setInterval(async () => {
    const cutoff = Date.now() - TRASH_RETENTION_MS;
    for (const drive of drives) {
        const trashed = getFilesByPath.all(drive.id, '.trash/');
        for (const file of trashed) {
            const trashedAt = new Date(`${file.modified_at.replace(' ', 'T')}Z`).getTime();
            if (trashedAt > cutoff) continue;
            try {
                await deleteFileFn(file.id);
            } catch {}
        }
    }
}, 60000);
