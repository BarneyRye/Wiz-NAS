import { db } from "@db/db.ts";
import type { RevokedToken } from "@packages/types.ts";

export const revokeToken = db.query<void, [string, number]>(
  "INSERT OR IGNORE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)"
);

export const getRevokedToken = db.query<RevokedToken, [string]>(
  "SELECT * FROM revoked_tokens WHERE jti = ?"
);

export const deleteExpiredTokens = db.query<void, [number]>(
  "DELETE FROM revoked_tokens WHERE expires_at < ?"
);
