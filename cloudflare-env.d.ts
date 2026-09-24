declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    APP_ENCRYPTION_KEY?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
  }
}
