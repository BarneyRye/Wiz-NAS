import type { Drive } from '@packages/types'
import { getDrives, insertDrive, updateDriveUsage } from '@db/queries'
import { scanDriveBytes, scanDriveFiles } from './libs/scan';

const drives = await constructDrives();

async function constructDrives(): Promise<Drive[]> {
    const numDrives = Number(process.env.NUM_DRIVES);
    if (!numDrives) throw new Error('Drive number not set in .env');

    const existing = new Map(getDrives.all().map(d => [d.path, d]));
    const drives: Drive[] = [];

    for (let i = 0; i < numDrives; i++) {
        const driveName = `DRIVE:${i}:NAME`;
        const drivePath = `DRIVE:${i}:PATH`;
        const name = process.env[driveName];
        const path = process.env[drivePath];
        if (!name || !path) throw new Error(`Drive ${i} configuration incomplete in .env`);
        const drive = existing.get(path) ?? insertDrive.get(name, path);
        if (!drive) throw new Error(`Failed to register drive ${i}`);
        drives.push(drive);
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
