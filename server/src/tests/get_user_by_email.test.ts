import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { getUserByEmail } from '../handlers/get_user_by_email';

describe('getUserByEmail', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user when email exists', async () => {
    // Create test user
    const testUser = {
      email: 'john@example.com',
      name: 'John Doe',
      password_hash: 'hashed_password_123'
    };

    const insertResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const createdUser = insertResult[0];

    // Test the handler
    const result = await getUserByEmail('john@example.com');

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdUser.id);
    expect(result!.email).toEqual('john@example.com');
    expect(result!.name).toEqual('John Doe');
    expect(result!.password_hash).toEqual('hashed_password_123');
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should return null when email does not exist', async () => {
    const result = await getUserByEmail('nonexistent@example.com');
    expect(result).toBeNull();
  });

  it('should be case sensitive for email lookup', async () => {
    // Create test user with lowercase email
    const testUser = {
      email: 'test@example.com',
      name: 'Test User',
      password_hash: 'hashed_password'
    };

    await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Test with exact match
    const exactMatch = await getUserByEmail('test@example.com');
    expect(exactMatch).not.toBeNull();

    // Test with different case
    const upperCaseMatch = await getUserByEmail('TEST@EXAMPLE.COM');
    expect(upperCaseMatch).toBeNull();
  });

  it('should return correct user when multiple users exist', async () => {
    // Create multiple test users
    const users = [
      {
        email: 'user1@example.com',
        name: 'User One',
        password_hash: 'hash1'
      },
      {
        email: 'user2@example.com',
        name: 'User Two',
        password_hash: 'hash2'
      },
      {
        email: 'user3@example.com',
        name: 'User Three',
        password_hash: 'hash3'
      }
    ];

    for (const user of users) {
      await db.insert(usersTable)
        .values(user)
        .execute();
    }

    // Test finding specific user
    const result = await getUserByEmail('user2@example.com');

    expect(result).not.toBeNull();
    expect(result!.email).toEqual('user2@example.com');
    expect(result!.name).toEqual('User Two');
    expect(result!.password_hash).toEqual('hash2');
  });

  it('should handle empty string email', async () => {
    const result = await getUserByEmail('');
    expect(result).toBeNull();
  });
});