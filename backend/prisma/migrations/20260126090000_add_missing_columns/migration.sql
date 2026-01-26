-- Add missing enum values
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'CLIENT_REVIEW';
ALTER TYPE "RevisionStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';

-- Add missing columns to projects table
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "domain_link" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "staging_link" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "staging_password" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "client_email" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "client_username" TEXT;

-- Add missing columns to tasks table
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "attachments" JSONB;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "submission_note" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "submission_attachments" JSONB;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "rejection_note" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "rejection_attachments" JSONB;

-- Add missing columns to design_assets table
ALTER TABLE "design_assets" ADD COLUMN IF NOT EXISTS "reference_attachments" JSONB;

-- Add missing columns to revisions table
ALTER TABLE "revisions" ADD COLUMN IF NOT EXISTS "developer_message" TEXT;
ALTER TABLE "revisions" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3);
ALTER TABLE "revisions" ADD COLUMN IF NOT EXISTS "manager_accepted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "revisions" ADD COLUMN IF NOT EXISTS "manager_accepted_at" TIMESTAMP(3);

-- Add missing columns to chat_messages table
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "mentions" JSONB;
