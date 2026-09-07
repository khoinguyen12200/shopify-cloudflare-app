PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_entitlement_operations` (
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
	CONSTRAINT "entitlement_operations_amounts_check" CHECK("__new_entitlement_operations"."requested_amount" >= 0 AND "__new_entitlement_operations"."requested_amount" <= 9007199254740991 AND "__new_entitlement_operations"."reserved_amount" >= 0 AND "__new_entitlement_operations"."reserved_amount" <= 9007199254740991 AND ("__new_entitlement_operations"."actual_amount" IS NULL OR ("__new_entitlement_operations"."actual_amount" >= 0 AND "__new_entitlement_operations"."actual_amount" <= 9007199254740991))),
	CONSTRAINT "entitlement_operations_state_check" CHECK("__new_entitlement_operations"."state" IN ('held', 'committed', 'released'))
);
--> statement-breakpoint
INSERT INTO `__new_entitlement_operations`("shop", "operation_id", "key", "period", "requested_amount", "reserved_amount", "actual_amount", "subscription_revision", "state", "created_at", "updated_at") SELECT "shop", "operation_id", "key", "period", "requested_amount", "reserved_amount", "actual_amount", "subscription_revision", "state", "created_at", "updated_at" FROM `entitlement_operations`;--> statement-breakpoint
DROP TABLE `entitlement_operations`;--> statement-breakpoint
ALTER TABLE `__new_entitlement_operations` RENAME TO `entitlement_operations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `entitlement_operations_lookup_idx` ON `entitlement_operations` (`shop`,`key`,`period`,`state`);--> statement-breakpoint
CREATE TABLE `__new_entitlement_usage` (
	`shop` text NOT NULL,
	`key` text NOT NULL,
	`period` text NOT NULL,
	`committed` integer DEFAULT 0 NOT NULL,
	`held` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`shop`, `key`, `period`),
	CONSTRAINT "entitlement_usage_amounts_check" CHECK("__new_entitlement_usage"."committed" >= 0 AND "__new_entitlement_usage"."committed" <= 9007199254740991 AND "__new_entitlement_usage"."held" >= 0 AND "__new_entitlement_usage"."held" <= 9007199254740991)
);
--> statement-breakpoint
INSERT INTO `__new_entitlement_usage`("shop", "key", "period", "committed", "held", "updated_at") SELECT "shop", "key", "period", "committed", "held", "updated_at" FROM `entitlement_usage`;--> statement-breakpoint
DROP TABLE `entitlement_usage`;--> statement-breakpoint
ALTER TABLE `__new_entitlement_usage` RENAME TO `entitlement_usage`;