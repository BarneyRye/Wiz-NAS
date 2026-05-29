import { db } from "@db/db.ts";
import type { Drive } from "@packages/types.ts";

export const getDrives = db.query<Drive, []>("SELECT * FROM drives");

export const getDriveById = db.query<Drive, [number]>(
    "SELECT * FROM drives WHERE id = ?"
);

export const insertDrive = db.query<Drive, [string, string]>(
    "INSERT INTO drives (name, path) VALUES (?, ?) RETURNING *"
);

export const updateDriveUsage = db.query<void, [number, number, number]>(
    "UPDATE drives SET total_bytes = ?, used_bytes = ? WHERE id = ?"
);

export const deleteDrive = db.query<void, [number]>(
    "DELETE FROM drives WHERE id = ?"
);

export const renameDrive = db.query<Drive, [string, number]>(
    "UPDATE drives SET name ? WHERE id = ?"
)
