ALTER TYPE "public"."channel_type" ADD VALUE 'line';--> statement-breakpoint
CREATE TABLE "channel_credentials" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"secret_cipher" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_credentials" ADD CONSTRAINT "channel_credentials_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_credentials" ADD CONSTRAINT "channel_credentials_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;