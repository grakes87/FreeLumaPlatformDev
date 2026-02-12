import { hash, compare } from 'bcryptjs';
import { BCRYPT_ROUNDS } from '@/lib/utils/constants';

export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return compare(password, hashedPassword);
}
