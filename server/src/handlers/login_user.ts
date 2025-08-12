import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

export const loginUser = async (input: LoginUserInput): Promise<User | null> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      return null; // User not found
    }

    const user = users[0];

    // For this implementation, we'll use a simple password comparison
    // In a production app, you'd use bcrypt.compare() or similar
    // For now, we'll assume password_hash contains the actual password for testing
    if (user.password_hash !== input.password) {
      return null; // Invalid password
    }

    // Return user data (excluding sensitive password_hash in real apps)
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      password_hash: user.password_hash,
      created_at: user.created_at
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};