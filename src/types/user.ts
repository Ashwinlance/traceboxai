export type UserRole = 'ADMIN' | 'SURVEYOR' | 'SUPERVISOR';

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
}
