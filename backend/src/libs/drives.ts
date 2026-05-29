import type { Drive } from '@packages/types'
import { getDrives, getDriveById, renameDrive} from '@db/queries'

export function getDrivesFn(): Drive[] {
    const drives = getDrives.all();
    return drives;
}

export function getDriveByIdFn(id: number): Drive | null {
    const drive = getDriveById.get(id);
    return drive;
}

export function renameDriveFn(id: number, name: string): Drive | null {
    const drive = renameDrive.get(name,id);
    return drive;
}