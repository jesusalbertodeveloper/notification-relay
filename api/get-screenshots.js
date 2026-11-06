import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Fetch the latest 1000 screenshots ordered by newest first
    const result = await pool.query(
      'SELECT id, image_data, created_at FROM screenshots ORDER BY created_at DESC LIMIT 1000'
    );

    return res.status(200).json({ success: true, screenshots: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
