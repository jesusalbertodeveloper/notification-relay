import { Pool } from 'pg';
import { NextResponse } from 'next/server';

// Initialize pool using your environment variable connection string
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }, // Required for most cloud Postgres providers
});

// Helper function to ensure the table exists before executing queries
async function ensureTableExists() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS somesetting45 (
      word VARCHAR(255) PRIMARY KEY
    );
  `);
}

// GET: Query all words
export async function GET() {
  try {
    await ensureTableExists();
    const result = await pool.query('SELECT word FROM somesetting45');
    const words = result.rows.map(row => row.word);
    return NextResponse.json({ success: true, somesetting45: words });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Set / Add a word
export async function POST(request) {
  try {
    await ensureTableExists();
    const { word } = await request.json();
    if (!word) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 });
    }
    const cleanWord = word.trim().toLowerCase();
    
    // Insert, ignoring duplicates if it already exists
    await pool.query(
      'INSERT INTO somesetting45 (word) VALUES ($1) ON CONFLICT (word) DO NOTHING', 
      [cleanWord]
    );
    
    return NextResponse.json({ success: true, message: `Added '${cleanWord}'` });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Unset / Remove a word
export async function DELETE(request) {
  try {
    await ensureTableExists();
    const { word } = await request.json();
    if (!word) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 });
    }
    const cleanWord = word.trim().toLowerCase();
    
    await pool.query('DELETE FROM somesetting45 WHERE word = $1', [cleanWord]);
    
    return NextResponse.json({ success: true, message: `Removed '${cleanWord}'` });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
