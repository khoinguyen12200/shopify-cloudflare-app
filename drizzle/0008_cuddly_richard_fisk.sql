CREATE TABLE `ai_models` (
	`role` text PRIMARY KEY NOT NULL,
	`model_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE TABLE `ai_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`model_id` text NOT NULL,
	`feature` text NOT NULL,
	`shop` text,
	`status` text NOT NULL,
	`reason_code` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`latency_ms` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_runs_created_idx` ON `ai_runs` (`created_at`);--> statement-breakpoint
CREATE INDEX `ai_runs_role_created_idx` ON `ai_runs` (`role`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_runs_id_uidx` ON `ai_runs` (`id`);