import { Migration } from '@mikro-orm/migrations';

export class Migration20260330085407 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "credential" ("id" bigserial primary key, "type" text not null default 'broadcaster', "twitch_id" varchar(50) not null, "access_token" varchar(50) not null, "refresh_token" varchar(50) not null, "expires_at" timestamptz not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`);
    this.addSql(`create index "credential_twitch_id_index" on "credential" ("twitch_id");`);

    this.addSql(`create table "channel" ("id" bigserial primary key, "twitch_id" varchar(50) not null, "name" varchar(150) not null, "email" varchar(150) not null, "active" boolean not null default true, "valorant_account" varchar(150) null, "credential_id" bigint null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`);
    this.addSql(`create index "channel_twitch_id_index" on "channel" ("twitch_id");`);
    this.addSql(`alter table "channel" add constraint "channel_credential_id_unique" unique ("credential_id");`);

    this.addSql(`create table "stream" ("id" bigserial primary key, "twitch_id" varchar(50) not null, "title" varchar(255) not null, "started_at" timestamptz not null, "ended_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`);

    this.addSql(`create table "match" ("id" bigserial primary key, "match_id" varchar(50) not null, "rank" varchar(30) not null, "rr" smallint not null, "rr_change" smallint not null, "map" varchar(50) not null, "stream_id" bigint not null, "channel_id" bigint not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`);

    this.addSql(`alter table "credential" add constraint "credential_type_check" check ("type" in ('bot', 'broadcaster'));`);

    this.addSql(`alter table "channel" add constraint "channel_credential_id_foreign" foreign key ("credential_id") references "credential" ("id") on delete set null;`);

    this.addSql(`alter table "match" add constraint "match_stream_id_foreign" foreign key ("stream_id") references "stream" ("id");`);
    this.addSql(`alter table "match" add constraint "match_channel_id_foreign" foreign key ("channel_id") references "channel" ("id");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "channel" drop constraint "channel_credential_id_foreign";`);
    this.addSql(`alter table "match" drop constraint "match_channel_id_foreign";`);
    this.addSql(`alter table "match" drop constraint "match_stream_id_foreign";`);

    this.addSql(`drop table if exists "credential" cascade;`);
    this.addSql(`drop table if exists "channel" cascade;`);
    this.addSql(`drop table if exists "stream" cascade;`);
    this.addSql(`drop table if exists "match" cascade;`);
  }

}
