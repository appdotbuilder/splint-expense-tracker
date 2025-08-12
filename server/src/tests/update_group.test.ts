import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, groupsTable } from '../db/schema';
import { type UpdateGroupInput } from '../schema';
import { updateGroup } from '../handlers/update_group';
import { eq } from 'drizzle-orm';

describe('updateGroup', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test user
  const createTestUser = async () => {
    const result = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();
    return result[0];
  };

  // Helper function to create test group
  const createTestGroup = async (userId: number) => {
    const result = await db.insert(groupsTable)
      .values({
        name: 'Original Group',
        description: 'Original description',
        created_by: userId
      })
      .returning()
      .execute();
    return result[0];
  };

  it('should update group name only', async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);

    const updateInput: UpdateGroupInput = {
      id: group.id,
      name: 'Updated Group Name'
    };

    const result = await updateGroup(updateInput);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(group.id);
    expect(result!.name).toEqual('Updated Group Name');
    expect(result!.description).toEqual('Original description');
    expect(result!.created_by).toEqual(user.id);
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should update group description only', async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);

    const updateInput: UpdateGroupInput = {
      id: group.id,
      description: 'Updated description'
    };

    const result = await updateGroup(updateInput);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(group.id);
    expect(result!.name).toEqual('Original Group');
    expect(result!.description).toEqual('Updated description');
    expect(result!.created_by).toEqual(user.id);
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should update both name and description', async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);

    const updateInput: UpdateGroupInput = {
      id: group.id,
      name: 'New Name',
      description: 'New description'
    };

    const result = await updateGroup(updateInput);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(group.id);
    expect(result!.name).toEqual('New Name');
    expect(result!.description).toEqual('New description');
    expect(result!.created_by).toEqual(user.id);
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should set description to null when explicitly provided', async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);

    const updateInput: UpdateGroupInput = {
      id: group.id,
      description: null
    };

    const result = await updateGroup(updateInput);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(group.id);
    expect(result!.name).toEqual('Original Group');
    expect(result!.description).toBeNull();
    expect(result!.created_by).toEqual(user.id);
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should return existing group when no fields to update', async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);

    const updateInput: UpdateGroupInput = {
      id: group.id
    };

    const result = await updateGroup(updateInput);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(group.id);
    expect(result!.name).toEqual('Original Group');
    expect(result!.description).toEqual('Original description');
    expect(result!.created_by).toEqual(user.id);
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should save changes to database', async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);

    const updateInput: UpdateGroupInput = {
      id: group.id,
      name: 'Database Updated Name',
      description: 'Database updated description'
    };

    await updateGroup(updateInput);

    // Verify changes were persisted in database
    const updatedGroups = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.id, group.id))
      .execute();

    expect(updatedGroups).toHaveLength(1);
    expect(updatedGroups[0].name).toEqual('Database Updated Name');
    expect(updatedGroups[0].description).toEqual('Database updated description');
    expect(updatedGroups[0].created_by).toEqual(user.id);
    expect(updatedGroups[0].created_at).toBeInstanceOf(Date);
  });

  it('should return null when group does not exist', async () => {
    const updateInput: UpdateGroupInput = {
      id: 999, // Non-existent ID
      name: 'This should not work'
    };

    const result = await updateGroup(updateInput);

    expect(result).toBeNull();
  });

  it('should handle empty string as valid name', async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);

    // Note: Empty string should be caught by Zod validation in real usage,
    // but testing handler behavior if it somehow receives empty string
    const updateInput: UpdateGroupInput = {
      id: group.id,
      name: ''
    };

    const result = await updateGroup(updateInput);

    expect(result).not.toBeNull();
    expect(result!.name).toEqual('');
    expect(result!.description).toEqual('Original description');
  });

  it('should preserve original created_at timestamp', async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);
    const originalCreatedAt = group.created_at;

    // Wait a small amount to ensure time difference would be detectable
    await new Promise(resolve => setTimeout(resolve, 10));

    const updateInput: UpdateGroupInput = {
      id: group.id,
      name: 'Updated Name'
    };

    const result = await updateGroup(updateInput);

    expect(result).not.toBeNull();
    expect(result!.created_at.getTime()).toEqual(originalCreatedAt.getTime());
  });
});