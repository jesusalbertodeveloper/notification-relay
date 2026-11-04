import { Pool } from 'pg';

// Initialize pool using your environment variable connection string
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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

export default async function handler(req, res) {
  try {
    await ensureTableExists();

    // GET: Query all words
    if (req.method === 'GET') {
      const result = await pool.query('SELECT word FROM somesetting45');
      const words = result.rows.map(row => row.word);
      return res.status(200).json({ success: true, somesetting45: words });
    }

    // POST: Set / Add a word
    if (req.method === 'POST') {
      const { word } = req.body;
      if (!word) {
        return res.status(400).json({ success: false, error: 'Word is required' });
      }
      const cleanWord = word.trim().toLowerCase();
      
      await pool.query(
        'INSERT INTO somesetting45 (word) VALUES ($1) ON CONFLICT (word) DO NOTHING', 
        [cleanWord]
      );
      
      return res.status(200).json({ success: true, message: `Added '${cleanWord}'` });
    }

    // DELETE: Unset / Remove a word
    if (req.method === 'DELETE') {
      const { word } = req.body;
      if (!word) {
        return res.status(400).json({ success: false, error: 'Word is required' });
      }
      const cleanWord = word.trim().toLowerCase();
      
      await pool.query('DELETE FROM somesetting45 WHERE word = $1', [cleanWord]);
      
      return res.status(200).json({ success: true, message: `Removed '${cleanWord}'` });
    }

    // Handle unsupported methods
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
