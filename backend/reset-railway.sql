-- Drop all tables if exist
DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "notifications" CASCADE;
DROP TABLE IF EXISTS "chat_messages" CASCADE;
DROP TABLE IF EXISTS "revisions" CASCADE;
DROP TABLE IF EXISTS "design_assets" CASCADE;
DROP TABLE IF EXISTS "tasks" CASCADE;
DROP TABLE IF EXISTS "requirements" CASCADE;
DROP TABLE IF EXISTS "projects" CASCADE;
DROP TABLE IF EXISTS "fiverr_accounts" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "system_settings" CASCADE;
DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;

-- Drop enums
DROP TYPE IF EXISTS "UserRole" CASCADE;
DROP TYPE IF EXISTS "UserStatus" CASCADE;
DROP TYPE IF EXISTS "ProjectStatus" CASCADE;
DROP TYPE IF EXISTS "ProjectComplexity" CASCADE;
DROP TYPE IF EXISTS "ProjectPriority" CASCADE;
DROP TYPE IF EXISTS "TaskStatus" CASCADE;
DROP TYPE IF EXISTS "AssetType" CASCADE;
DROP TYPE IF EXISTS "AssetStatus" CASCADE;
DROP TYPE IF EXISTS "RequirementStatus" CASCADE;
DROP TYPE IF EXISTS "RevisionStatus" CASCADE;
DROP TYPE IF EXISTS "DeveloperTier" CASCADE;
DROP TYPE IF EXISTS "MessagePriority" CASCADE;

-- Create enums
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'TEAM_LEAD', 'DEVELOPER', 'DESIGNER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INVITED');
CREATE TYPE "ProjectStatus" AS ENUM ('NEW', 'REQUIREMENTS_PENDING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'ON_HOLD', 'CANCELLED');
CREATE TYPE "ProjectComplexity" AS ENUM ('SIMPLE', 'MEDIUM', 'COMPLEX');
CREATE TYPE "ProjectPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "TaskStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE "AssetType" AS ENUM ('LOGO', 'BANNER', 'IMAGE', 'ICON', 'OTHER');
CREATE TYPE "AssetStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE "RequirementStatus" AS ENUM ('DRAFT', 'APPROVED');
CREATE TYPE "RevisionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "DeveloperTier" AS ENUM ('JUNIOR', 'MID', 'SENIOR', 'EXPERT');
CREATE TYPE "MessagePriority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');

-- Create users table
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "bio" TEXT,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "developer_tier" "DeveloperTier",
    "invited_by_id" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reset_token" TEXT,
    "reset_token_expiry" TIMESTAMP(3),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_reset_token_key" ON "users"("reset_token");

-- Create fiverr_accounts table
CREATE TABLE "fiverr_accounts" (
    "id" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fiverr_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fiverr_accounts_account_name_key" ON "fiverr_accounts"("account_name");

-- Create projects table
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "internal_name" TEXT NOT NULL,
    "project_type" TEXT NOT NULL,
    "complexity" "ProjectComplexity" NOT NULL,
    "priority" "ProjectPriority" NOT NULL DEFAULT 'MEDIUM',
    "internal_deadline" TIMESTAMP(3),
    "fiverr_deadline" TIMESTAMP(3),
    "meeting_link" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'NEW',
    "budget" TEXT,
    "fiverr_account_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "manager_id" TEXT,
    "team_lead_id" TEXT,
    "designer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- Create requirements table
CREATE TABLE "requirements" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "attachments" JSONB,
    "status" "RequirementStatus" NOT NULL DEFAULT 'DRAFT',
    "project_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "requirements_project_id_version_key" ON "requirements"("project_id", "version");

-- Create tasks table
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'ASSIGNED',
    "project_id" TEXT NOT NULL,
    "assigned_to_id" TEXT NOT NULL,
    "assigned_by_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- Create design_assets table
CREATE TABLE "design_assets" (
    "id" TEXT NOT NULL,
    "asset_type" "AssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "file_url" TEXT,
    "file_name" TEXT,
    "file_size" INTEGER,
    "status" "AssetStatus" NOT NULL DEFAULT 'REQUESTED',
    "project_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "design_assets_pkey" PRIMARY KEY ("id")
);

-- Create revisions table
CREATE TABLE "revisions" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attachments" JSONB,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "status" "RevisionStatus" NOT NULL DEFAULT 'PENDING',
    "project_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "assigned_team_lead_id" TEXT,
    "assigned_developer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "revisions_pkey" PRIMARY KEY ("id")
);

-- Create chat_messages table
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" JSONB,
    "visible_to_roles" JSONB NOT NULL,
    "priority" "MessagePriority" NOT NULL DEFAULT 'NORMAL',
    "project_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- Create notifications table
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- Create audit_logs table
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- Create system_settings table
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- Create prisma migrations table
CREATE TABLE "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "users" ADD CONSTRAINT "users_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fiverr_accounts" ADD CONSTRAINT "fiverr_accounts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_fiverr_account_id_fkey" FOREIGN KEY ("fiverr_account_id") REFERENCES "fiverr_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_team_lead_id_fkey" FOREIGN KEY ("team_lead_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_designer_id_fkey" FOREIGN KEY ("designer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "design_assets" ADD CONSTRAINT "design_assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "design_assets" ADD CONSTRAINT "design_assets_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "design_assets" ADD CONSTRAINT "design_assets_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "design_assets" ADD CONSTRAINT "design_assets_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Insert admin user (password: Admin@123456)
INSERT INTO "users" ("id", "email", "password_hash", "name", "role", "status", "created_at", "updated_at")
VALUES (
    'cladmin001',
    'admin@deepaxis.com',
    '$2b$10$K1XPBxjVNYNqH3.PO7cGxOqHqsYLqM9xyspQdJhHJ5.nQb6vEKxCe',
    'System Admin',
    'ADMIN',
    'ACTIVE',
    NOW(),
    NOW()
);

-- Insert Fiverr Account
INSERT INTO "fiverr_accounts" ("id", "account_name", "account_email", "is_active", "created_by_id", "created_at", "updated_at")
VALUES (
    'clfiverr001',
    'DEEPAXIS_Main',
    'main@deepaxis.com',
    true,
    'cladmin001',
    NOW(),
    NOW()
);

-- Insert system settings
INSERT INTO "system_settings" ("id", "key", "value", "category", "updated_at")
VALUES
    ('clset001', 'smtp_config', '{"host":"smtp.gmail.com","port":587,"secure":false,"auth":{"user":"","pass":""},"from":"noreply@deepaxis.com"}', 'SMTP', NOW()),
    ('clset002', 'n8n_config', '{"enabled":false,"webhookUrl":"","apiKey":""}', 'N8N', NOW()),
    ('clset003', 'general_config', '{"companyName":"DEEPAXIS","timezone":"UTC","dateFormat":"YYYY-MM-DD","notificationsEnabled":true}', 'GENERAL', NOW());
