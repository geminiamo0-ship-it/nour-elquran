import type { CoreDatabase } from '../bindings.ts';
export type OwnerAccount = { id: string; status: 'active' | 'disabled' };
export async function ownerAccount(db: CoreDatabase, userId: string): Promise<OwnerAccount | null> {
  let owner = await db.prepare('SELECT id,status FROM accounts WHERE auth_subject=?').bind(userId).first<OwnerAccount>();
  if (!owner) {
    await db.prepare("INSERT OR IGNORE INTO accounts(id,auth_subject,status,created_at_ms) VALUES(?,?,'active',?)")
      .bind(crypto.randomUUID(), userId, Date.now()).run();
    owner = await db.prepare('SELECT id,status FROM accounts WHERE auth_subject=?').bind(userId).first<OwnerAccount>();
  }
  return owner?.status === 'active' ? owner : null;
}
