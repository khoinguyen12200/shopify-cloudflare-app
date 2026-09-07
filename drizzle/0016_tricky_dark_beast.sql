CREATE TABLE `entitlement_allocations` (
	`shop` text NOT NULL,
	`key` text NOT NULL,
	`allocation_id` text NOT NULL,
	`subscription_revision` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`shop`, `key`, `allocation_id`),
	CONSTRAINT "entitlement_allocations_state_check" CHECK("entitlement_allocations"."state" IN ('held', 'allocated', 'released'))
);
--> statement-breakpoint
CREATE INDEX `entitlement_allocations_lookup_idx` ON `entitlement_allocations` (`shop`,`key`,`state`);--> statement-breakpoint
CREATE TABLE `entitlement_operations` (
	`shop` text NOT NULL,
	`operation_id` text NOT NULL,
	`key` text NOT NULL,
	`period` text NOT NULL,
	`requested_amount` integer NOT NULL,
	`reserved_amount` integer NOT NULL,
	`actual_amount` integer,
	`subscription_revision` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`shop`, `operation_id`),
	CONSTRAINT "entitlement_operations_amounts_check" CHECK("entitlement_operations"."requested_amount" >= 0 AND "entitlement_operations"."reserved_amount" >= 0 AND ("entitlement_operations"."actual_amount" IS NULL OR "entitlement_operations"."actual_amount" >= 0)),
	CONSTRAINT "entitlement_operations_state_check" CHECK("entitlement_operations"."state" IN ('held', 'committed', 'released'))
);
--> statement-breakpoint
CREATE INDEX `entitlement_operations_lookup_idx` ON `entitlement_operations` (`shop`,`key`,`period`,`state`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_entitlement_usage` (
	`shop` text NOT NULL,
	`key` text NOT NULL,
	`period` text NOT NULL,
	`committed` integer DEFAULT 0 NOT NULL,
	`held` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`shop`, `key`, `period`),
	CONSTRAINT "entitlement_usage_amounts_check" CHECK("__new_entitlement_usage"."committed" >= 0 AND "__new_entitlement_usage"."held" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_entitlement_usage`("shop", "key", "period", "committed", "held", "updated_at") SELECT "shop", "key", "period", "committed", "held", "updated_at" FROM `entitlement_usage`;--> statement-breakpoint
DROP TABLE `entitlement_usage`;--> statement-breakpoint
ALTER TABLE `__new_entitlement_usage` RENAME TO `entitlement_usage`;--> statement-breakpoint
PRAGMA foreign_keys=ON;