import type { User, Role } from '@packages/types'
import { getUsers, getUserById, getUserByUsername, updateUserRole, setUserBlocked, deleteUser } from '@db/queries'
import { AdminChangeError, NotFoundError } from './errors';

export function getUsersFn(): User[] {
    const users = getUsers.all();
    return users;
}

export function getUserByIdFn(id: number): User | null {
    const user = getUserById.get(id);
    return user;
}

export function getUserByUsernameFn(username: string): User | null {
    const user = getUserByUsername.get(username);
    return user;
}

function checkAdminUser(id: number): boolean {
    const user = getUserByIdFn(id);
    if (!user) throw new NotFoundError(`User ${id} not found`);
    if (user.username === 'admin') return true;
    return false;
}

export function updateUserRoleFn(id: number, role: Role): void {
    if (checkAdminUser(id)) throw new AdminChangeError("Can't change role of username: admin"); 
    updateUserRole.run(role, id);
}

export function setUserBlockedFn(id: number, blocked: number): void {
    if (checkAdminUser(id)) throw new AdminChangeError("Can't block user of username: admin");    
    setUserBlocked.run(blocked, id);
}

export function deleteUserFn(id: number): void {
    if (checkAdminUser(id)) throw new AdminChangeError("Can't delete user of username: admin");    
    deleteUser.run(id);
}
