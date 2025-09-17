import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const hasUrl = !!process.env.DATABASE_URL;

export const config = {
  databaseUrl: process.env.DATABASE_URL, // optional
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT ? Number(process.env.POSTGRES_PORT) : undefined,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  ssl: (process.env.POSTGRES_SSL ?? 'false').toLowerCase() === 'true',
  validate() {
    if (!hasUrl) {
      required('POSTGRES_HOST');
      required('POSTGRES_USER');
      required('POSTGRES_PASSWORD');
      required('POSTGRES_DB');
    }
  }
};

config.validate();
