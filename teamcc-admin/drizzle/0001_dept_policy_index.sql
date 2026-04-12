DROP INDEX IF EXISTS "dept_policies_dept_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dept_policies_department_idx" ON "department_policies" ("department_id");
