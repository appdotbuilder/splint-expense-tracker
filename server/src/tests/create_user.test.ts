import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test input data
const testInput: CreateUserInput = {
  email: 'test@example.com',
  name: 'Test User',
  password: 'password123'
};

const anotherTestInput: CreateUserInput = {
  email: 'another@example.com',
  name: 'Another User',
  password: 'differentpassword456'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with hashed password', async () => {
    const result = await createUser(testInput);

    // Verify basic fields
    expect(result.email).toEqual('test@example.com');
    expect(result.name).toEqual('Test User');
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
    
    // Verify password is hashed (not the original password)
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('password123');
    expect(result.password_hash.length).toBeGreaterThan(20); // Hashed passwords are longer
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];
    
    expect(savedUser.email).toEqual('test@example.com');
    expect(savedUser.name).toEqual('Test User');
    expect(savedUser.password_hash).toBeDefined();
    expect(savedUser.password_hash).not.toEqual('password123');
    expect(savedUser.created_at).toBeInstanceOf(Date);
  });

  it('should create multiple users with different emails', async () => {
    const user1 = await createUser(testInput);
    const user2 = await createUser(anotherTestInput);

    // Verify both users were created with different IDs
    expect(user1.id).not.toEqual(user2.id);
    expect(user1.email).toEqual('test@example.com');
    expect(user2.email).toEqual('another@example.com');

    // Verify both users exist in database
    const allUsers = await db.select()
      .from(usersTable)
      .execute();

    expect(allUsers).toHaveLength(2);
  });

  it('should throw error when email already exists', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create another user with same email
    const duplicateInput: CreateUserInput = {
      ...testInput,
      name: 'Different Name'
    };

    await expect(createUser(duplicateInput)).rejects.toThrow(/already exists/i);

    // Verify only one user exists in database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, testInput.email))
      .execute();

    expect(users).toHaveLength(1);
  });

  it('should properly hash different passwords', async () => {
    const user1 = await createUser(testInput);
    const user2 = await createUser(anotherTestInput);

    // Verify passwords are hashed differently
    expect(user1.password_hash).not.toEqual(user2.password_hash);
    expect(user1.password_hash).not.toEqual('password123');
    expect(user2.password_hash).not.toEqual('differentpassword456');

    // Verify hashes can be verified with original passwords
    const isUser1PasswordValid = await Bun.password.verify('password123', user1.password_hash);
    const isUser2PasswordValid = await Bun.password.verify('differentpassword456', user2.password_hash);

    expect(isUser1PasswordValid).toBe(true);
    expect(isUser2PasswordValid).toBe(true);

    // Verify wrong passwords don't match
    const isWrongPassword1 = await Bun.password.verify('wrongpassword', user1.password_hash);
    const isWrongPassword2 = await Bun.password.verify('password123', user2.password_hash);

    expect(isWrongPassword1).toBe(false);
    expect(isWrongPassword2).toBe(false);
  });
});