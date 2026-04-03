import { Migration } from '@mikro-orm/migrations';

export class Migration20260403120740 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "match" drop constraint "match_stream_id_foreign";`);

    this.addSql(`alter table "match" drop constraint "match_match_id_unique";`);
    this.addSql(`alter table "match" alter column "stream_id" drop not null;`);
    this.addSql(`alter table "match" add constraint "match_stream_id_foreign" foreign key ("stream_id") references "stream" ("id") on delete set null;`);
    this.addSql(`create index "match_match_id_index" on "match" ("match_id");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "match" drop constraint "match_stream_id_foreign";`);

    this.addSql(`drop index "match_match_id_index";`);
    this.addSql(`alter table "match" alter column "stream_id" set not null;`);
    this.addSql(`alter table "match" add constraint "match_stream_id_foreign" foreign key ("stream_id") references "stream" ("id") on update no action on delete no action;`);
    this.addSql(`alter table "match" add constraint "match_match_id_unique" unique ("match_id");`);
  }

}
