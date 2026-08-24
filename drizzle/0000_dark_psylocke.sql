CREATE TABLE `shops` (
	`shop` text PRIMARY KEY NOT NULL,
	`installed_at` integer NOT NULL,
	`uninstalled_at` integer
);
--> statement-breakpoint
CREATE INDEX `shops_uninstalled_at_idx` ON `shops` (`uninstalled_at`);