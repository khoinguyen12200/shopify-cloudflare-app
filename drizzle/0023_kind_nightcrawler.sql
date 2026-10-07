CREATE TABLE `mcp_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`token_id` text,
	`client_id` text,
	`actor_email` text NOT NULL,
	`actor_type` text NOT NULL,
	`tool_name` text NOT NULL,
	`shop` text,
	`is_mutation` integer NOT NULL,
	`ok` integer NOT NULL,
	`latency_ms` integer NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`token_id`) REFERENCES `mcp_tokens`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`client_id`) REFERENCES `mcp_clients`(`client_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `mcp_audit_logs_created_at_idx` ON `mcp_audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `mcp_audit_logs_tool_name_idx` ON `mcp_audit_logs` (`tool_name`);--> statement-breakpoint
CREATE INDEX `mcp_audit_logs_shop_idx` ON `mcp_audit_logs` (`shop`);--> statement-breakpoint
CREATE INDEX `mcp_audit_logs_actor_email_idx` ON `mcp_audit_logs` (`actor_email`);--> statement-breakpoint
CREATE TABLE `mcp_authorization_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`client_id` text NOT NULL,
	`admin_user_id` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`scope` text NOT NULL,
	`resource` text,
	`code_challenge` text NOT NULL,
	`code_challenge_method` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `mcp_clients`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_authorization_codes_code_hash_unique` ON `mcp_authorization_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `mcp_auth_codes_code_hash_idx` ON `mcp_authorization_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `mcp_auth_codes_client_id_idx` ON `mcp_authorization_codes` (`client_id`);--> statement-breakpoint
CREATE INDEX `mcp_auth_codes_expires_at_idx` ON `mcp_authorization_codes` (`expires_at`);--> statement-breakpoint
CREATE TABLE `mcp_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`client_secret_hash` text,
	`client_secret_prefix` text,
	`client_name` text NOT NULL,
	`client_type` text DEFAULT 'public' NOT NULL,
	`registration_type` text NOT NULL,
	`redirect_uris` text NOT NULL,
	`allowed_scopes` text NOT NULL,
	`created_by_admin_id` text,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`created_by_admin_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_clients_client_id_unique` ON `mcp_clients` (`client_id`);--> statement-breakpoint
CREATE INDEX `mcp_clients_client_id_idx` ON `mcp_clients` (`client_id`);--> statement-breakpoint
CREATE INDEX `mcp_clients_revoked_at_idx` ON `mcp_clients` (`revoked_at`);--> statement-breakpoint
CREATE TABLE `mcp_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`client_id` text,
	`admin_user_id` text,
	`label` text NOT NULL,
	`scopes` text NOT NULL,
	`parent_token_id` text,
	`expires_at` integer,
	`last_used_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `mcp_clients`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_tokens_token_hash_unique` ON `mcp_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `mcp_tokens_token_hash_idx` ON `mcp_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `mcp_tokens_client_id_idx` ON `mcp_tokens` (`client_id`);--> statement-breakpoint
CREATE INDEX `mcp_tokens_admin_user_id_idx` ON `mcp_tokens` (`admin_user_id`);--> statement-breakpoint
CREATE INDEX `mcp_tokens_revoked_at_idx` ON `mcp_tokens` (`revoked_at`);--> statement-breakpoint
ALTER TABLE `shops` ADD `is_dev_store` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `shops_is_dev_store_idx` ON `shops` (`is_dev_store`);