CREATE TABLE `support_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`shop` text NOT NULL,
	`r2_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `support_messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `support_attachments_message_idx` ON `support_attachments` (`message_id`);--> statement-breakpoint
CREATE INDEX `support_attachments_shop_idx` ON `support_attachments` (`shop`);--> statement-breakpoint
CREATE TABLE `support_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`shop` text NOT NULL,
	`author` text NOT NULL,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `support_messages_ticket_idx` ON `support_messages` (`ticket_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `support_messages_shop_idx` ON `support_messages` (`shop`);--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`shop` text NOT NULL,
	`shop_name` text NOT NULL,
	`merchant_email` text,
	`cc_emails` text DEFAULT '[]' NOT NULL,
	`category` text NOT NULL,
	`subject` text NOT NULL,
	`last_author` text NOT NULL,
	`last_message_at` integer NOT NULL,
	`closed_at` integer,
	`merchant_last_read_at` integer,
	`staff_last_read_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `support_tickets_shop_idx` ON `support_tickets` (`shop`);--> statement-breakpoint
CREATE INDEX `support_tickets_queue_idx` ON `support_tickets` (`closed_at`,`last_author`,`last_message_at`);--> statement-breakpoint
CREATE INDEX `support_tickets_shop_recent_idx` ON `support_tickets` (`shop`,`last_message_at`);--> statement-breakpoint
ALTER TABLE `admin_users` ADD `notify_support` integer DEFAULT true NOT NULL;