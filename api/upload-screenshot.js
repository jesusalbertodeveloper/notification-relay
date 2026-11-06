import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Automatically create the screenshots table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS screenshots (
        id SERIAL PRIMARY KEY,
        image_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: 'Image data is required' });
    }

    // Insert the base64 PNG string into your PostgreSQL database
    await pool.query(
      'INSERT INTO screenshots (image_data) VALUES ($1)',
      [image]
    );

    return res.status(200).json({ success: true, message: 'Screenshot uploaded and saved successfully!' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
