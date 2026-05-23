CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`timestamp_ms` integer NOT NULL,
	`last_modified_ms` integer NOT NULL,
	`is_incognito` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transcriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`text` text NOT NULL,
	`timestamp_ms` integer NOT NULL,
	`audio_path` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transcriptions_session_id_idx` ON `transcriptions` (`session_id`);--> statement-breakpoint
CREATE INDEX `transcriptions_timestamp_idx` ON `transcriptions` (`timestamp_ms`);