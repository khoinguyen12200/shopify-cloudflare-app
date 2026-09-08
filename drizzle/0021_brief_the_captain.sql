PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_entitlement_allocations` (
	`shop` text NOT NULL,
	`key` text NOT NULL,
	`allocation_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`subscription_revision` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`shop`, `operation_id`),
	CONSTRAINT "entitlement_allocations_state_check" CHECK("__new_entitlement_allocations"."state" IN ('held', 'allocated', 'released'))
);
--> statement-breakpoint
INSERT INTO `__new_entitlement_allocations`("shop", "key", "allocation_id", "operation_id", "subscription_revision", "state", "created_at", "updated_at") SELECT "shop", "key", "allocation_id", CASE WHEN "operation_id" = 'legacy' THEN 'legacy:' || "key" || ':' || "allocation_id" ELSE "operation_id" END, "subscription_revision", "state", "created_at", "updated_at" FROM `entitlement_allocations`;--> statement-breakpoint
DROP TABLE `entitlement_allocations`;--> statement-breakpoint
ALTER TABLE `__new_entitlement_allocations` RENAME TO `entitlement_allocations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `entitlement_allocations_lookup_idx` ON `entitlement_allocations` (`shop`,`key`,`state`);
