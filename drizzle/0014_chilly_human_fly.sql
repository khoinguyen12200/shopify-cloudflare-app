CREATE TABLE `pending_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`shop` text NOT NULL,
	`ticket_id` text,
	`r2_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`adopted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pending_uploads_r2_key_unique` ON `pending_uploads` (`r2_key`);--> statement-breakpoint
CREATE INDEX `pending_uploads_shop_idx` ON `pending_uploads` (`shop`,`created_at`);--> statement-breakpoint
CREATE INDEX `pending_uploads_expiry_idx` ON `pending_uploads` (`expires_at`);