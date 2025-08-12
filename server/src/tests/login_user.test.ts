import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginUserInput } from '../schema';
import { loginUser } from '../handlers/login_user';

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data
  const testUser = {
    email: 'test@example.com',
    name: 'Test User',
    password_hash: 'test123' // In real apps, this would be hashed
  };

  const validLoginInput: LoginUserInput = {
    email: 'test@example.com',
    password: 'test123'
  };

  const invalidPasswordInput: LoginUserInput = {
    email: 'test@example.com',
    password: 'wrongpassword'
  };

  const nonExistentUserInput: LoginUserInput = {
    email: 'nonexistent@example.com',
    password: 'anypassword'
  };

  it('should login user with valid credentials', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const result = await loginUser(validLoginInput);

    expect(result).not.toBeNull();
    expect(result!.email).toEqual('test@example.com');
    expect(result!.name).toEqual('Test User');
    expect(result!.password_hash).toEqual('test123');
    expect(result!.id).toBeDefined();
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should return null for invalid password', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const result = await loginUser(invalidPasswordInput);

    expect(result).toBeNull();
  });

  it('should return null for non-existent user', async () => {
    const result = await loginUser(nonExistentUserInput);

    expect(result).toBeNull();
  });

  it('should return null for empty email', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const emptyEmailInput: LoginUserInput = {
      email: '',
      password: 'test123'
    };

    const result = await loginUser(emptyEmailInput);

    expect(result).toBeNull();
  });

  it('should handle case-sensitive email matching', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const caseVariationInput: LoginUserInput = {
      email: 'TEST@EXAMPLE.COM',
      password: 'test123'
    };

    const result = await loginUser(caseVariationInput);

    // Should return null because email is case-sensitive
    expect(result).toBeNull();
  });

  it('should handle multiple users with same password correctly', async () => {
    // Create two test users
    const user1 = {
      email: 'user1@example.com',
      name: 'User One',
      password_hash: 'samepassword'
    };

    const user2 = {
      email: 'user2@example.com',
      name: 'User Two',
      password_hash: 'samepassword'
    };

    await db.insert(usersTable)
      .values([user1, user2])
      .execute();

    // Login as first user
    const loginUser1: LoginUserInput = {
      email: 'user1@example.com',
      password: 'samepassword'
    };

    const result1 = await loginUser(loginUser1);
    expect(result1).not.toBeNull();
    expect(result1!.email).toEqual('user1@example.com');
    expect(result1!.name).toEqual('User One');

    // Login as second user
    const loginUser2: LoginUserInput = {
      email: 'user2@example.com',
      password: 'samepassword'
    };

    const result2 = await loginUser(loginUser2);
    expect(result2).not.toBeNull();
    expect(result2!.email).toEqual('user2@example.com');
    expect(result2!.name).toEqual('User Two');
  });
});