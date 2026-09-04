import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { contentDir } from "@/lib/contentFiles";

// Persist the connection on globalThis so Next.js HMR module reloads reuse it
// instead of opening a second connection (which causes WAL checkpoint conflicts).
const g = globalThis as typeof globalThis & { __sgDb?: Database.Database };

export function getDb(): Database.Database {
  if (g.__sgDb) return g.__sgDb;

  const dbPath = path.join(contentDir(), "suwaneegamers.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  // Several processes write this file — the dev server, the prod service, and
  // the sync scripts the scheduler spawns. WAL keeps readers unblocked, but
  // writers still serialize, and a bulk sync (content-documents rewrites all
  // 50+ rows in one transaction) can outlast better-sqlite3's 5s default.
  // Keep this in step with scripts/sync-db.mjs.
  db.pragma("busy_timeout = 15000");
  initializeSchema(db);
  migrateSchema(db);
  g.__sgDb = db;
  return db;
}

function migrateSchema(db: Database.Database): void {
  const securityBlocksSchema = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'security_blocks'`)
    .get() as { sql: string } | undefined;
  if (securityBlocksSchema && !securityBlocksSchema.sql.includes("'pending'")) {
    db.transaction(() => {
      db.exec(`
        ALTER TABLE security_blocks RENAME TO security_blocks_legacy;
        CREATE TABLE security_blocks (
          ip                 TEXT PRIMARY KEY,
          cloudflare_rule_id TEXT,
          status             TEXT NOT NULL CHECK (status IN ('pending', 'active', 'failed', 'removed')),
          source             TEXT NOT NULL CHECK (source IN ('automatic', 'manual')),
          reason             TEXT NOT NULL,
          created_at         TEXT NOT NULL,
          updated_at         TEXT NOT NULL,
          removed_at         TEXT,
          last_error         TEXT
        );
        INSERT INTO security_blocks SELECT * FROM security_blocks_legacy;
        DROP TABLE security_blocks_legacy;
        CREATE INDEX IF NOT EXISTS idx_security_blocks_status_updated
          ON security_blocks(status, updated_at DESC);
      `);
    })();
  }

  const campaignColumns = new Set(
    (db.prepare(`PRAGMA table_info(campaigns)`).all() as { name: string }[]).map((c) => c.name),
  );
  if (!campaignColumns.has("start_date")) db.exec(`ALTER TABLE campaigns ADD COLUMN start_date TEXT`);
  if (!campaignColumns.has("end_date")) db.exec(`ALTER TABLE campaigns ADD COLUMN end_date TEXT`);

  const hasRefUrl = db
    .prepare(`SELECT COUNT(*) AS n FROM pragma_table_info('campaigns') WHERE name = 'reference_url'`)
    .get() as { n: number };
  if (hasRefUrl.n > 0) {
    db.exec(`ALTER TABLE campaigns DROP COLUMN reference_url`);
  }

  // Drop denormalized columns — activeCampaignIds is now computed from campaigns.dm at runtime
  const dmColumns = new Set(
    (db.prepare(`PRAGMA table_info(dungeon_masters)`).all() as { name: string }[]).map((c) => c.name),
  );
  if (dmColumns.has("active_campaign_ids")) {
    db.exec(`ALTER TABLE dungeon_masters DROP COLUMN active_campaign_ids`);
  }

  // Drop always-NULL dm_profile_id — computed at runtime via name-matching DMs
  const playerColumns = new Set(
    (db.prepare(`PRAGMA table_info(players)`).all() as { name: string }[]).map((c) => c.name),
  );
  if (playerColumns.has("dm_profile_id")) {
    db.exec(`ALTER TABLE players DROP COLUMN dm_profile_id`);
  }

  // Add missing indexes (including unique slug enforcement for existing gazetteer tables)
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_gazetteer_slug ON gazetteer(slug);
    CREATE INDEX IF NOT EXISTS idx_gazetteer_region ON gazetteer(region);
    CREATE INDEX IF NOT EXISTS idx_campaigns_dm ON campaigns(dm);
  `);

  // Backfill campaign_dms junction table from campaigns.dm if it's empty but campaigns exist
  const cdCount = (db.prepare(`SELECT COUNT(*) AS n FROM campaign_dms`).get() as { n: number }).n;
  const campaignCount = (db.prepare(`SELECT COUNT(*) AS n FROM campaigns`).get() as { n: number }).n;
  if (cdCount === 0 && campaignCount > 0) {
    const campaignRows = db.prepare(`SELECT id, dm FROM campaigns`).all() as { id: string; dm: string }[];
    const findDm = db.prepare(`SELECT id FROM dungeon_masters WHERE name = ?`);
    const insertCd = db.prepare(`INSERT OR IGNORE INTO campaign_dms (campaign_id, dm_id) VALUES (?, ?)`);
    db.transaction(() => {
      for (const row of campaignRows) {
        for (const dmName of row.dm.split(/\s*&\s*/)) {
          const dm = findDm.get(dmName.trim()) as { id: string } | undefined;
          if (dm) insertCd.run(row.id, dm.id);
        }
      }
    })();
  }

  // Seed custom_pages from pages.json on first startup
  const cpCount = (db.prepare(`SELECT COUNT(*) AS n FROM custom_pages`).get() as { n: number }).n;
  if (cpCount === 0) {
    try {
      const raw = fs.readFileSync(path.join(contentDir(), "pages.json"), "utf-8");
      const pages = JSON.parse(raw) as Array<{ id: string; slug: string; title: string; status: string; createdAt: string }>;
      const ins = db.prepare(`INSERT OR IGNORE INTO custom_pages (id, slug, title, status, created_at) VALUES (?, ?, ?, ?, ?)`);
      for (const p of pages) ins.run(p.id, p.slug, p.title, p.status, p.createdAt);
    } catch { /* pages.json absent on fresh install */ }
  }

  // Seed bestiary from bestiary.json on first startup
  const bCount = (db.prepare(`SELECT COUNT(*) AS n FROM bestiary`).get() as { n: number }).n;
  if (bCount === 0) {
    try {
      const raw = fs.readFileSync(path.join(contentDir(), "bestiary.json"), "utf-8");
      const creatures = JSON.parse(raw) as Array<{ name: string; type: string; image?: string; href?: string }>;
      const ins = db.prepare(`INSERT OR IGNORE INTO bestiary (id, name, type, image, href) VALUES (?, ?, ?, ?, ?)`);
      for (const c of creatures) {
        ins.run(c.name.toLowerCase().replace(/[^a-z0-9]/g, "-"), c.name, c.type, c.image ?? null, c.href ?? null);
      }
    } catch { /* bestiary.json absent on fresh install */ }
  }

  // Seed content_documents with config files (nav, portal-links, theme) on first startup
  const checkDoc = db.prepare(`SELECT COUNT(*) AS n FROM content_documents WHERE path = ?`);
  const insDoc = db.prepare(
    `INSERT OR IGNORE INTO content_documents (path, json, updated_at, source) VALUES (?, ?, ?, 'filesystem')`,
  );
  for (const file of ["nav.json", "portal-links.json", "theme.json"]) {
    const exists = (checkDoc.get(file) as { n: number }).n > 0;
    if (!exists) {
      try {
        const json = fs.readFileSync(path.join(contentDir(), file), "utf-8");
        insDoc.run(file, json, new Date().toISOString());
      } catch { /* file absent on fresh install */ }
    }
  }

  // Add schedule_json column for user-editable schedules
  const jobColumns = new Set(
    (db.prepare(`PRAGMA table_info(content_sync_jobs)`).all() as { name: string }[]).map((c) => c.name),
  );
  if (!jobColumns.has("schedule_json")) {
    db.exec(`ALTER TABLE content_sync_jobs ADD COLUMN schedule_json TEXT`);
  }
  if (!jobColumns.has("revalidate_paths_json")) {
    db.exec(`ALTER TABLE content_sync_jobs ADD COLUMN revalidate_paths_json TEXT`);
  }
  if (!jobColumns.has("source_job_id")) {
    db.exec(`ALTER TABLE content_sync_jobs ADD COLUMN source_job_id TEXT`);
  }

  const storeProductColumns = new Set(
    (db.prepare(`PRAGMA table_info(store_products)`).all() as { name: string }[]).map((column) => column.name),
  );
  if (!storeProductColumns.has("category")) {
    db.exec(`ALTER TABLE store_products ADD COLUMN category TEXT NOT NULL DEFAULT 'other'`);
  }

  const gazetteerColumns = new Set(
    (db.prepare(`PRAGMA table_info(gazetteer)`).all() as { name: string }[]).map((column) => column.name),
  );
  const addGazetteerColumn = (name: string, type: string) => {
    if (!gazetteerColumns.has(name)) db.exec(`ALTER TABLE gazetteer ADD COLUMN ${name} ${type}`);
  };
  addGazetteerColumn("folder_url", "TEXT");
  addGazetteerColumn("reference_url", "TEXT");
  addGazetteerColumn("image_url", "TEXT");
  addGazetteerColumn("image_source_file_id", "TEXT");
  addGazetteerColumn("image_source_file_name", "TEXT");
  addGazetteerColumn("size", "TEXT");
  addGazetteerColumn("region", "TEXT");
  addGazetteerColumn("description", "TEXT");

  // Per-member Myra persona (voice + speaking manner), added with the persona system
  const userProfileColumns = new Set(
    (db.prepare(`PRAGMA table_info(user_profiles)`).all() as { name: string }[]).map((c) => c.name),
  );
  if (!userProfileColumns.has("myra_persona")) {
    db.exec(`ALTER TABLE user_profiles ADD COLUMN myra_persona TEXT`);
  }

  // Identify analytics sessions once Google sign-in is enforced
  const analyticsSessionColumns = new Set(
    (db.prepare(`PRAGMA table_info(analytics_sessions)`).all() as { name: string }[]).map((c) => c.name),
  );
  if (!analyticsSessionColumns.has("visitor_email")) {
    db.exec(`ALTER TABLE analytics_sessions ADD COLUMN visitor_email TEXT`);
  }
  if (!analyticsSessionColumns.has("visitor_name")) {
    db.exec(`ALTER TABLE analytics_sessions ADD COLUMN visitor_name TEXT`);
  }
  if (!analyticsSessionColumns.has("visitor_id")) {
    db.exec(`ALTER TABLE analytics_sessions ADD COLUMN visitor_id TEXT`);
  }
  const addAnalyticsSessionColumn = (name: string) => {
    if (!analyticsSessionColumns.has(name)) {
      db.exec(`ALTER TABLE analytics_sessions ADD COLUMN ${name} TEXT`);
    }
  };
  addAnalyticsSessionColumn("acquisition_path");
  addAnalyticsSessionColumn("utm_source");
  addAnalyticsSessionColumn("utm_medium");
  addAnalyticsSessionColumn("utm_campaign");

  // Records which model answered each voice question. Historically this
  // distinguished Claude from the retired local fallback; today it is "claude"
  // for LLM answers and null for deterministic ones.
  const voiceQuestionColumns = new Set(
    (db.prepare(`PRAGMA table_info(voice_questions)`).all() as { name: string }[]).map((c) => c.name),
  );
  if (!voiceQuestionColumns.has("model")) {
    db.exec(`ALTER TABLE voice_questions ADD COLUMN model TEXT`);
  }

  // Provider usage attached to each LLM timing event. Keeping this on the same
  // row makes latency, tokens, model selection, and estimated cost auditable
  // without trying to join two asynchronous event streams.
  const voiceMetricColumns = new Set(
    (db.prepare(`PRAGMA table_info(voice_metrics)`).all() as { name: string }[]).map((c) => c.name),
  );
  const addVoiceMetricColumn = (name: string, type: string) => {
    if (!voiceMetricColumns.has(name)) {
      db.exec(`ALTER TABLE voice_metrics ADD COLUMN ${name} ${type}`);
    }
  };
  addVoiceMetricColumn("provider", "TEXT");
  addVoiceMetricColumn("model", "TEXT");
  addVoiceMetricColumn("input_tokens", "INTEGER");
  addVoiceMetricColumn("output_tokens", "INTEGER");
  addVoiceMetricColumn("cache_read_tokens", "INTEGER");
  addVoiceMetricColumn("cache_creation_tokens", "INTEGER");
  addVoiceMetricColumn("estimated_cost_microusd", "INTEGER");

  // Moderator censorship of an Advents Guide review keeps the rating but hides
  // the comment; the original text is retained so a DM/admin can restore it.
  const adventsReviewColumns = new Set(
    (db.prepare(`PRAGMA table_info(advents_guide_reviews)`).all() as { name: string }[]).map((c) => c.name),
  );
  if (!adventsReviewColumns.has("censored")) {
    db.exec(`ALTER TABLE advents_guide_reviews ADD COLUMN censored INTEGER NOT NULL DEFAULT 0`);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_purpose_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      source TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      purpose TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      path TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(source, source_id)
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_sessions_visitor
      ON analytics_sessions(visitor_id, last_seen_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analytics_sessions_email
      ON analytics_sessions(visitor_email, last_seen_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_session_created
      ON analytics_events(session_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analytics_purpose_created
      ON analytics_purpose_signals(purpose, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analytics_purpose_session
      ON analytics_purpose_signals(session_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email
      ON user_profiles(email);
    CREATE INDEX IF NOT EXISTS idx_voice_metrics_provider_created
      ON voice_metrics(provider, created_at DESC);
  `);
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    -- ----------------------------------------------------------------
    -- Signed-in visitor profiles
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS user_profiles (
      id                      TEXT PRIMARY KEY,
      google_sub              TEXT,
      email                   TEXT NOT NULL,
      display_name            TEXT NOT NULL,
      player_name             TEXT,
      favorite_locations_json TEXT NOT NULL DEFAULT '[]',
      myra_enabled            INTEGER NOT NULL DEFAULT 1,
      myra_persona            TEXT,
      created_at              TEXT NOT NULL,
      updated_at              TEXT NOT NULL,
      last_seen_at            TEXT NOT NULL
    );

    -- ----------------------------------------------------------------
    -- Store catalog and orders
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS store_products (
      id                 TEXT PRIMARY KEY,
      slug               TEXT NOT NULL UNIQUE,
      name               TEXT NOT NULL,
      short_description  TEXT NOT NULL DEFAULT '',
      description        TEXT NOT NULL DEFAULT '',
      price_cents        INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
      currency           TEXT NOT NULL DEFAULT 'USD',
      image_url          TEXT,
      category           TEXT NOT NULL DEFAULT 'other',
      inventory_quantity INTEGER,
      status             TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'active', 'archived')),
      fulfillment_type   TEXT NOT NULL DEFAULT 'physical'
                         CHECK (fulfillment_type IN ('physical', 'digital', 'event')),
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS store_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT OR IGNORE INTO store_settings (key, value, updated_at)
      VALUES ('storefront_enabled', 'false', CURRENT_TIMESTAMP);

    CREATE TABLE IF NOT EXISTS store_orders (
      id                  TEXT PRIMARY KEY,
      order_number        TEXT NOT NULL UNIQUE,
      user_email          TEXT,
      customer_email      TEXT,
      customer_name       TEXT,
      status              TEXT NOT NULL DEFAULT 'pending',
      currency            TEXT NOT NULL DEFAULT 'USD',
      subtotal_cents      INTEGER NOT NULL,
      tax_cents           INTEGER NOT NULL DEFAULT 0,
      shipping_cents      INTEGER NOT NULL DEFAULT 0,
      total_cents         INTEGER NOT NULL,
      paypal_order_id     TEXT UNIQUE,
      paypal_capture_id   TEXT UNIQUE,
      shipping_json       TEXT,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS store_order_items (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id           TEXT NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
      product_id         TEXT REFERENCES store_products(id) ON DELETE SET NULL,
      product_name       TEXT NOT NULL,
      unit_price_cents   INTEGER NOT NULL,
      quantity           INTEGER NOT NULL CHECK (quantity > 0),
      line_total_cents   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS store_product_variants (
      id                 TEXT PRIMARY KEY,
      product_id         TEXT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
      name               TEXT NOT NULL,
      sku                TEXT,
      price_cents        INTEGER,
      inventory_quantity INTEGER,
      active             INTEGER NOT NULL DEFAULT 1,
      sort_order         INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_store_variants_product
      ON store_product_variants(product_id, sort_order);

    CREATE TABLE IF NOT EXISTS store_webhook_events (
      paypal_event_id TEXT PRIMARY KEY,
      event_type      TEXT NOT NULL,
      payload_json    TEXT NOT NULL,
      processed_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_store_products_status
      ON store_products(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_store_orders_created
      ON store_orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_store_orders_email
      ON store_orders(user_email, created_at DESC);

    -- ----------------------------------------------------------------
    -- Campaigns
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS campaigns (
      id                           TEXT PRIMARY KEY,
      name                         TEXT NOT NULL,
      dm                           TEXT NOT NULL,
      schedule                     TEXT NOT NULL,
      start_date                   TEXT,
      end_date                     TEXT,
      description                  TEXT NOT NULL,
      header_image                 TEXT,
      header_image_position        TEXT NOT NULL DEFAULT 'center',
      header_image_source_folder   TEXT,
      header_image_source_file_id  TEXT,
      header_image_source_file_name TEXT,
      official                     INTEGER NOT NULL DEFAULT 1,
      player_notes_url             TEXT,
      aliases                      TEXT NOT NULL DEFAULT '[]',
      resources                    TEXT NOT NULL DEFAULT '[]',
      party                        TEXT NOT NULL DEFAULT '[]'
    );

    -- ----------------------------------------------------------------
    -- Session summaries (split out of campaigns for unbounded growth)
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS session_summaries (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id  TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      title        TEXT    NOT NULL,
      summary      TEXT    NOT NULL,
      audio_links  TEXT    NOT NULL DEFAULT '[]',
      auto         INTEGER NOT NULL DEFAULT 0,
      session_date TEXT,
      sort_order   INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_session_summaries_campaign
      ON session_summaries(campaign_id, sort_order);

    -- FTS5 for session summary search
    CREATE VIRTUAL TABLE IF NOT EXISTS session_summaries_fts USING fts5(
      campaign_id UNINDEXED,
      title,
      summary,
      content=session_summaries,
      content_rowid=id
    );

    CREATE TRIGGER IF NOT EXISTS ss_ai AFTER INSERT ON session_summaries BEGIN
      INSERT INTO session_summaries_fts(rowid, campaign_id, title, summary)
        VALUES (new.id, new.campaign_id, new.title, new.summary);
    END;

    CREATE TRIGGER IF NOT EXISTS ss_ad AFTER DELETE ON session_summaries BEGIN
      INSERT INTO session_summaries_fts(session_summaries_fts, rowid, campaign_id, title, summary)
        VALUES ('delete', old.id, old.campaign_id, old.title, old.summary);
    END;

    CREATE TRIGGER IF NOT EXISTS ss_au AFTER UPDATE ON session_summaries BEGIN
      INSERT INTO session_summaries_fts(session_summaries_fts, rowid, campaign_id, title, summary)
        VALUES ('delete', old.id, old.campaign_id, old.title, old.summary);
      INSERT INTO session_summaries_fts(rowid, campaign_id, title, summary)
        VALUES (new.id, new.campaign_id, new.title, new.summary);
    END;

    -- ----------------------------------------------------------------
    -- Dungeon Masters
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS dungeon_masters (
      id                 TEXT PRIMARY KEY,
      name               TEXT NOT NULL,
      focus              TEXT NOT NULL,
      description        TEXT NOT NULL,
      portrait           TEXT,
      previous_campaigns TEXT NOT NULL DEFAULT '[]'
    );

    -- ----------------------------------------------------------------
    -- Players
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS players (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT NOT NULL,
      portrait    TEXT
    );

    -- ----------------------------------------------------------------
    -- Organizations
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS organizations (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      known_for   TEXT,
      summary     TEXT,
      details     TEXT,
      description TEXT,
      image       TEXT,
      href        TEXT,
      faction     INTEGER NOT NULL DEFAULT 0
    );

    -- ----------------------------------------------------------------
    -- Territories
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS territories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      capital     TEXT,
      region      TEXT NOT NULL,
      description TEXT NOT NULL,
      image       TEXT,
      href        TEXT
    );

    -- ----------------------------------------------------------------
    -- Campaign DM assignments (junction table normalizing campaigns.dm)
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS campaign_dms (
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      dm_id       TEXT NOT NULL REFERENCES dungeon_masters(id) ON DELETE CASCADE,
      PRIMARY KEY (campaign_id, dm_id)
    );

    CREATE INDEX IF NOT EXISTS idx_campaign_dms_dm ON campaign_dms(dm_id);

    -- ----------------------------------------------------------------
    -- Advents Guide to Myrdae
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS advents_guide_subjects (
      id                 TEXT PRIMARY KEY,
      kind               TEXT NOT NULL CHECK (kind IN ('location', 'business')),
      map_location_id    TEXT NOT NULL,
      parent_subject_id  TEXT REFERENCES advents_guide_subjects(id) ON DELETE CASCADE,
      name               TEXT NOT NULL,
      created_by_user_id TEXT REFERENCES user_profiles(id) ON DELETE SET NULL,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_advents_guide_location_subject
      ON advents_guide_subjects(map_location_id) WHERE kind = 'location';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_advents_guide_business_subject
      ON advents_guide_subjects(map_location_id, lower(name)) WHERE kind = 'business';
    CREATE INDEX IF NOT EXISTS idx_advents_guide_subject_parent
      ON advents_guide_subjects(parent_subject_id);

    CREATE TABLE IF NOT EXISTS advents_guide_reviews (
      id              TEXT PRIMARY KEY,
      subject_id      TEXT NOT NULL REFERENCES advents_guide_subjects(id) ON DELETE CASCADE,
      user_profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      character_name  TEXT NOT NULL,
      rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment         TEXT NOT NULL DEFAULT '',
      censored        INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      UNIQUE (subject_id, user_profile_id)
    );

    CREATE INDEX IF NOT EXISTS idx_advents_guide_reviews_subject
      ON advents_guide_reviews(subject_id, updated_at DESC);

    -- ----------------------------------------------------------------
    -- Gazetteer entries
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS gazetteer (
      id                     TEXT PRIMARY KEY,
      title                  TEXT NOT NULL,
      slug                   TEXT NOT NULL UNIQUE,
      doc_url                TEXT NOT NULL,
      folder_url             TEXT,
      reference_url          TEXT,
      image_url              TEXT,
      image_source_file_id   TEXT,
      image_source_file_name TEXT,
      size                   TEXT,
      region                 TEXT,
      description            TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_gazetteer_region ON gazetteer(region);
    CREATE INDEX IF NOT EXISTS idx_campaigns_dm ON campaigns(dm);

    -- ----------------------------------------------------------------
    -- Content sync scheduler
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS content_sync_jobs (
      id                TEXT PRIMARY KEY,
      label             TEXT NOT NULL,
      schedule          TEXT NOT NULL,
      command           TEXT NOT NULL,
      enabled           INTEGER NOT NULL DEFAULT 1,
      last_started_at   TEXT,
      last_finished_at  TEXT,
      last_success_at   TEXT,
      last_status       TEXT,
      last_exit_code    INTEGER,
      last_duration_ms  INTEGER,
      next_run_at       TEXT,
      last_message      TEXT
    );

    CREATE TABLE IF NOT EXISTS content_sync_runs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id        TEXT NOT NULL REFERENCES content_sync_jobs(id) ON DELETE CASCADE,
      started_at    TEXT NOT NULL,
      finished_at   TEXT,
      status        TEXT NOT NULL,
      exit_code     INTEGER,
      duration_ms   INTEGER,
      message       TEXT,
      stdout_tail   TEXT,
      stderr_tail   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_content_sync_runs_job_started
      ON content_sync_runs(job_id, started_at DESC);

    -- ----------------------------------------------------------------
    -- Privacy-conscious site analytics
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS analytics_sessions (
      session_id    TEXT PRIMARY KEY,
      first_seen_at TEXT NOT NULL,
      last_seen_at  TEXT NOT NULL,
      entry_path    TEXT NOT NULL,
      last_path     TEXT NOT NULL,
      referrer_host TEXT,
      device_type   TEXT NOT NULL DEFAULT 'desktop',
      page_views    INTEGER NOT NULL DEFAULT 0,
      engaged_seconds INTEGER NOT NULL DEFAULT 0,
      visitor_id    TEXT,
      visitor_email TEXT,
      visitor_name  TEXT,
      acquisition_path TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id       TEXT NOT NULL REFERENCES analytics_sessions(session_id) ON DELETE CASCADE,
      event_type       TEXT NOT NULL,
      path             TEXT NOT NULL,
      content_type     TEXT,
      content_id       TEXT,
      content_label    TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analytics_purpose_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      source TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      purpose TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      path TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(source, source_id)
    );

    CREATE INDEX IF NOT EXISTS idx_analytics_events_created
      ON analytics_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created
      ON analytics_events(event_type, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_path_created
      ON analytics_events(path, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analytics_purpose_created
      ON analytics_purpose_signals(purpose, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analytics_purpose_session
      ON analytics_purpose_signals(session_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analytics_sessions_last_seen
      ON analytics_sessions(last_seen_at DESC);

    -- ----------------------------------------------------------------
    -- Voice assistant analytics (admin-only question text)
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS voice_sessions (
      session_id     TEXT PRIMARY KEY,
      room_name      TEXT NOT NULL UNIQUE,
      member_id      TEXT NOT NULL,
      member_name    TEXT,
      member_email   TEXT,
      started_at     TEXT NOT NULL,
      ended_at       TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      status         TEXT NOT NULL DEFAULT 'started',
      question_count INTEGER NOT NULL DEFAULT 0,
      error_count    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS voice_questions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id     TEXT NOT NULL REFERENCES voice_sessions(session_id) ON DELETE CASCADE,
      asked_at       TEXT NOT NULL,
      question       TEXT NOT NULL,
      answer         TEXT,
      category       TEXT NOT NULL,
      response_mode  TEXT NOT NULL,
      -- Which language model actually answered ("claude"; older rows may hold
      -- the retired local model's name). Null for deterministic answers, which
      -- never reach a model at all.
      model          TEXT,
      response_ms    INTEGER,
      success        INTEGER NOT NULL DEFAULT 1,
      error_message  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_voice_sessions_started
      ON voice_sessions(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_voice_questions_asked
      ON voice_questions(asked_at DESC);
    CREATE INDEX IF NOT EXISTS idx_voice_questions_category
      ON voice_questions(category, asked_at DESC);

    -- Granular per-turn timing metrics (TTFT, end-of-utterance, TTS TTFB,
    -- interruptions) forwarded by the agent; feed the nightly autotuner.
    CREATE TABLE IF NOT EXISTS voice_metrics (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    TEXT,
      kind          TEXT NOT NULL,
      value_ms      INTEGER,
      cached_tokens INTEGER,
      provider      TEXT,
      model         TEXT,
      input_tokens  INTEGER,
      output_tokens INTEGER,
      cache_read_tokens INTEGER,
      cache_creation_tokens INTEGER,
      estimated_cost_microusd INTEGER,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS myra_health_incidents (
      id                TEXT PRIMARY KEY,
      service           TEXT NOT NULL,
      started_at        TEXT NOT NULL,
      resolved_at       TEXT,
      status            TEXT NOT NULL CHECK (status IN ('active', 'resolved')),
      severity          TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
      summary           TEXT NOT NULL,
      technical_details TEXT,
      user_impact       TEXT,
      resolution        TEXT,
      last_seen_at      TEXT NOT NULL,
      occurrence_count  INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_myra_health_incidents_status
      ON myra_health_incidents(status, started_at DESC);

    CREATE INDEX IF NOT EXISTS idx_voice_metrics_kind_created
      ON voice_metrics(kind, created_at DESC);

    -- ----------------------------------------------------------------
    -- Voice-assistant user feedback: site wishes, complaints, and praise a
    -- visitor voiced to Myra ("I wish the site had...", "I don't like...").
    -- Surfaced in /admin/feedback so the group can see what to improve.
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS voice_feedback (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    TEXT,
      created_at    TEXT NOT NULL,
      -- 'wish' (feature request) | 'complaint' | 'praise'.
      kind          TEXT NOT NULL,
      -- The visitor's own words, kept verbatim so the ask is legible.
      message       TEXT NOT NULL,
      member_name   TEXT,
      member_email  TEXT,
      -- Where the visitor was when they said it, for context.
      page_path     TEXT,
      -- 'new' | 'reviewed' | 'done' | 'dismissed', driven from the admin page.
      status        TEXT NOT NULL DEFAULT 'new'
    );
    CREATE INDEX IF NOT EXISTS idx_voice_feedback_created
      ON voice_feedback(status, created_at DESC);

    -- ----------------------------------------------------------------
    -- Custom pages (admin-created pages with slugs)
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS custom_pages (
      id         TEXT PRIMARY KEY,
      slug       TEXT NOT NULL UNIQUE,
      title      TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    -- ----------------------------------------------------------------
    -- Bestiary (custom creatures for the campaign)
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS bestiary (
      id    TEXT PRIMARY KEY,
      name  TEXT NOT NULL,
      type  TEXT NOT NULL,
      image TEXT,
      href  TEXT
    );

    -- ----------------------------------------------------------------
    -- Security log (failed admin logins, suspicious/admin requests)
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS security_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      kind       TEXT NOT NULL,
      ip         TEXT,
      method     TEXT,
      path       TEXT NOT NULL,
      user_agent TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_security_events_created
      ON security_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_security_events_kind_created
      ON security_events(kind, created_at DESC);

    -- Cloudflare edge blocks created by automatic detection or an admin.
    -- Keeping the provider rule id makes every block reversible from the UI.
    CREATE TABLE IF NOT EXISTS security_blocks (
      ip                 TEXT PRIMARY KEY,
      cloudflare_rule_id TEXT,
      status             TEXT NOT NULL CHECK (status IN ('pending', 'active', 'failed', 'removed')),
      source             TEXT NOT NULL CHECK (source IN ('automatic', 'manual')),
      reason             TEXT NOT NULL,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL,
      removed_at         TEXT,
      last_error         TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_security_blocks_status_updated
      ON security_blocks(status, updated_at DESC);

    -- ----------------------------------------------------------------
    -- JSON content documents
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS content_documents (
      path        TEXT PRIMARY KEY,
      json        TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      source      TEXT NOT NULL DEFAULT 'filesystem'
    );
  `);
}
