PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ai_models` (
	`role` text NOT NULL,
	`model_id` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`healthy` integer DEFAULT true NOT NULL,
	`last_failed_at` integer,
	`updated_at` integer NOT NULL,
	`updated_by` text,
	PRIMARY KEY(`role`, `model_id`)
);
--> statement-breakpoint
INSERT INTO `__new_ai_models`("role", "model_id", "priority", "enabled", "healthy", "last_failed_at", "updated_at", "updated_by") SELECT "role", "model_id", "priority", "enabled", "healthy", "last_failed_at", "updated_at", "updated_by" FROM `ai_models`;--> statement-breakpoint
DROP TABLE `ai_models`;--> statement-breakpoint
ALTER TABLE `__new_ai_models` RENAME TO `ai_models`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `ai_models_role_priority_idx` ON `ai_models` (`role`,`priority`);