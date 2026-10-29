import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const authUsers = sqliteTable('auth_users', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  phoneNumber: text('phone_number').unique(),
  phoneNumberVerified: integer('phone_number_verified', { mode: 'boolean' }).default(false),
});
export const authSessions = sqliteTable('auth_sessions', {
  id: text('id').primaryKey().notNull(),
  token: text('token').notNull().unique(),
  userId: text('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
}, table => [index('auth_session_user').on(table.userId)]);
export const authCredentials = sqliteTable('auth_credentials', {
  id: text('id').primaryKey().notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  password: text('password'),
  accessToken: text('access_token'), refreshToken: text('refresh_token'), idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
  scope: text('scope'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, table => [index('auth_credential_user').on(table.userId),
  uniqueIndex('auth_credential_provider').on(table.providerId, table.accountId)]);
export const authVerifications = sqliteTable('auth_verifications', {
  id: text('id').primaryKey().notNull(), identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, table => [index('auth_verification_identifier').on(table.identifier)]);
export const authRateLimits = sqliteTable('auth_rate_limits', {
  id: text('id').primaryKey().notNull(), key: text('key').notNull().unique(),
  count: integer('count').notNull(), lastRequest: integer('last_request').notNull(),
});
export const authSchema = { authUsers, authSessions, authCredentials, authVerifications, authRateLimits };

