ALTER TABLE "clients" ADD COLUMN "cust_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_user_name_custid_uq" ON "clients" USING btree ("user_id","name","cust_id");