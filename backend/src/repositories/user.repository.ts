import { eq, and } from 'drizzle-orm';
import { users, tenants } from '../db/index.js';
import type { DatabaseClient } from '../db/index.js';
import type { User, NewUser } from '../db/index.js';

export class UserRepository {
  constructor(private db: DatabaseClient) {}

  async findByEmail(email: string, tenantId: string): Promise<User | undefined> {
    const rows = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.tenantId, tenantId)))
      .limit(1);

    return rows[0];
  }

  async findById(id: string): Promise<User | undefined> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return rows[0];
  }

  async create(data: NewUser): Promise<User> {
    const rows = await this.db.insert(users).values(data).returning();
    return rows[0]!;
  }

  async tenantExists(tenantId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return rows.length > 0;
  }
}
