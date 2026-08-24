CREATE TABLE `notification_opt_outs` (
	`scope` text NOT NULL,
	`channel` text NOT NULL,
	`address` text NOT NULL,
	`opted_out_at` integer NOT NULL,
	`source` text,
	PRIMARY KEY(`scope`, `channel`, `address`)
);
--> statement-breakpoint
CREATE INDEX `notification_opt_outs_address_idx` ON `notification_opt_outs` (`address`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`scope` text NOT NULL,
	`event` text NOT NULL,
	`channel` text NOT NULL,
	`enabled` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`scope`, `event`, `channel`)
);
--> statement-breakpoint
CREATE INDEX `notification_preferences_scope_idx` ON `notification_preferences` (`scope`);