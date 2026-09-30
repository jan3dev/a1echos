CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD `folder_id` text REFERENCES folders(id) ON DELETE set null;