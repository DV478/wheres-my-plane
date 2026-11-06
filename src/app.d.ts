import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';

declare global {
  namespace App {
    interface Locals {
      user: {
        id: string;
        email: string;
        tgChatId: string | null;
        homeTz: string | null;
      } | null;
      sessionId: string | null;
    }

    interface PageData {
      user: Locals['user'];
    }

    interface Platform {
      env: {
        DB: D1Database;
        CACHE: KVNamespace;
        BLOBS: R2Bucket;

        RESEND_API_KEY: string;
        MAGIC_LINK_FROM: string;
        PUBLIC_BASE_URL: string;
        SESSION_SECRET: string;

        AERODATABOX_RAPIDAPI_KEY?: string;
        AIRLABS_KEY?: string;
        AVIATIONSTACK_KEY?: string;
        OPENAI_API_KEY?: string;
        GEMINI_API_KEY?: string;

        OPENSKY_USER?: string;
        OPENSKY_PASS?: string;
        WMP_INGEST_SECRET?: string;
        WMP_CRON_SECRET?: string;
        TELEGRAM_BOT_TOKEN?: string;
        TELEGRAM_WEBHOOK_SECRET?: string;
        GITHUB_PAT_ACTIONS_DISPATCH?: string;
        GITHUB_REPO?: string;
        PUBLIC_PROTOMAPS_TILE_URL?: string;
      };
      context: {
        waitUntil(promise: Promise<unknown>): void;
      };
      caches: CacheStorage & { default: Cache };
    }
  }
}

export {};
