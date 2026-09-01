CREATE TABLE `webhook_scope_observations` (
	`delivery_id` text NOT NULL,
	`shop` text NOT NULL,
	`scope` text NOT NULL,
	PRIMARY KEY(`delivery_id`, `scope`),
	FOREIGN KEY (`delivery_id`) REFERENCES `webhook_deliveries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `webhook_scope_observations_shop_idx` ON `webhook_scope_observations` (`shop`);