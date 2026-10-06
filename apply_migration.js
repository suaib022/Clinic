const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error("No DATABASE_URL in .env.local");
        return;
    }
    const pool = new Pool({ connectionString });
    try {
        const sql = fs.readFileSync('supabase/migrations/20261003200000_module4_compounder.sql', 'utf8');
        // Need to create pgcrypto extension for digest() just in case it doesn't exist
        await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
        await pool.query(sql);
        console.log("Migration applied successfully.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await pool.end();
    }
}
main();
