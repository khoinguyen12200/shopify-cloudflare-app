CREATE TABLE `entitlement_usage` (
	`shop` text NOT NULL,
	`key` text NOT NULL,
	`period` text NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`shop`, `key`, `period`)
);
--> statement-breakpoint
CREATE INDEX `entitlement_usage_shop_period_idx` ON `entitlement_usage` (`shop`,`period`);