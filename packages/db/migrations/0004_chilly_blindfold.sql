CREATE TABLE "bot_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"channel_id" text,
	"match_type" text NOT NULL,
	"pattern" text NOT NULL,
	"action" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_cursors" (
	"subscriber" text PRIMARY KEY NOT NULL,
	"last_created_at" timestamp with time zone,
	"last_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bot_rules" ADD CONSTRAINT "bot_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_rules" ADD CONSTRAINT "bot_rules_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_bot_rules_lookup" ON "bot_rules" USING btree ("workspace_id","channel_id","enabled");