CREATE TABLE `notification_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`channel` text NOT NULL,
	`recipient` text NOT NULL,
	`status` text NOT NULL,
	`reason_code` text,
	`detail` text,
	`provider_status` text,
	`provider_message_id` text,
	`dedupe_key` text,
	`shop` text,
	`created_at` integer NOT NULL,
	`settled_at` integer
);
--> statement-breakpoint
CREATE INDEX `notification_logs_event_idx` ON `notification_logs` (`event`);--> statement-breakpoint
CREATE INDEX `notification_logs_recipient_idx` ON `notification_logs` (`recipient`);--> statement-breakpoint
CREATE INDEX `notification_logs_dedupe_idx` ON `notification_logs` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `notification_logs_shop_idx` ON `notification_logs` (`shop`);--> statement-breakpoint
CREATE INDEX `notification_logs_created_idx` ON `notification_logs` (`created_at`);