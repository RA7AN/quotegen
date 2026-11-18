CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'Company profile' NOT NULL,
	"is_default" boolean DEFAULT true NOT NULL,
	"payload" jsonb NOT NULL,
	"header_mark" text,
	"footer_mark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profiles_user_idx" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profiles_user_default_idx" ON "profiles" USING btree ("user_id","is_default");