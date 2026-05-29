import { db } from "@db/db.ts";
import type { User, Role } from "@packages/types.ts";

export const getUserByUsername = db.query<User, [string]>(
    "SELECT * FROM users WHERE username = ?"
);

export const getUserById = db.query<User, [number]>(
    "SELECT * FROM users WHERE id = ?"
);

export const insertUser = db.query<User, [string, string, Role]>(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?) RETURNING *"
);

export const updateUserRole = db.query<void, [Role, number]>(
    "UPDATE users SET role = ? WHERE id = ?"
);

export const deleteUser = db.query<void, [number]>(
    "DELETE FROM users WHERE id = ?"
);

export const updateUserName = db.query<void, [string, number]>(
    "UPDATE users SET username = ? WHERE id = ?"
);

export const updateUserPassword = db.query<void, [string, number]>(
    "UPDATE users SET password_hash = ? WHERE id = ?"
);

export const setUserBlocked = db.query<void, [number, number]>(
    "UPDATE users SET blocked = ? WHERE id = ?"
);
