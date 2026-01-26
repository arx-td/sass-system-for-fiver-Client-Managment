-- Create DeveloperTier enum
DO $$ BEGIN
    CREATE TYPE "DeveloperTier" AS ENUM ('TRAINEE', 'JUNIOR', 'MID', 'SENIOR', 'ELITE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add tier system columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tier" "DeveloperTier" DEFAULT 'TRAINEE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "completed_projects" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "average_rating" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "total_reviews" INTEGER NOT NULL DEFAULT 0;

-- Create project_reviews table
CREATE TABLE IF NOT EXISTS "project_reviews" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "client_feedback" TEXT,
    "admin_notes" TEXT,
    "code_quality" INTEGER,
    "communication_score" INTEGER,
    "delivery_speed" INTEGER,
    "problem_solving" INTEGER,
    "project_id" TEXT NOT NULL,
    "developer_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_reviews_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for project_reviews
DO $$ BEGIN
    ALTER TABLE "project_reviews" ADD CONSTRAINT "project_reviews_project_id_developer_id_key" UNIQUE ("project_id", "developer_id");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add foreign key constraints for project_reviews
DO $$ BEGIN
    ALTER TABLE "project_reviews" ADD CONSTRAINT "project_reviews_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "project_reviews" ADD CONSTRAINT "project_reviews_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "project_reviews" ADD CONSTRAINT "project_reviews_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
