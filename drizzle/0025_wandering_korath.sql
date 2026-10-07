CREATE TABLE `shop_plan_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`shop` text NOT NULL,
	`plan_handle` text NOT NULL,
	`reason` text NOT NULL,
	`granted_by` text NOT NULL,
	`starts_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`revoked_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`shop`) REFERENCES `shops`(`shop`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shop_plan_grants_shop_idx` ON `shop_plan_grants` (`shop`);--> statement-breakpoint
CREATE INDEX `shop_plan_grants_lookup_idx` ON `shop_plan_grants` (`shop`,`expires_at`,`revoked_at`);