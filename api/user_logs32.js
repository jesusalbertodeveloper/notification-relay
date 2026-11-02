import { Pool } from 'pg';

// Persistent Database connection for Vercel/Supabase using connection string
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    prepareThreshold: 0
});

export default async function handler(req, res) {
    try {
        // Ensure the table exists with the updated names and can store unlimited entries
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_logs33 (
                id bigserial primary key,
                package_name text not null,
                info_33 text not null,
                created_at timestamp with time zone default timezone('utc'::text, now()) not null
            );
        `);

        // --- HANDLE POST REQUEST (Log New Input) ---
        if (req.method === 'POST') {
            const { packageName, info33 } = req.body;
            
            // Support both camelCase and snake_case property keys from the client body
            const textContent = info33 || req.body.info_33;
            
            if (!packageName || !textContent) {
                return res.status(400).json({ error: 'Missing required parameters (packageName or info_33)' });
            }

            const insertQuery = `
                INSERT INTO user_logs33 (package_name, info_33) 
                VALUES ($1, $2)
                RETURNING id, created_at;
            `;
            const result = await pool.query(insertQuery, [packageName, textContent]);
            const newEntry = result.rows[0];

            return res.status(200).json({ 
                success: true, 
                message: 'Input logged successfully',
                entry: {
                    id: newEntry.id,
                    packageName,
                    info_33: textContent,
                    createdAt: newEntry.created_at
                }
            });
        } 
        
        // --- HANDLE GET REQUEST (Read All Logs with Password Authentication) ---
        else if (req.method === 'GET') {
            const password = req.headers['x-api-password'] || req.query.password;
            const requiredPassword = process.env.VAR33;

            if (!requiredPassword || password !== requiredPassword) {
                return res.status(401).json({ error: 'Unauthorized: Invalid or missing password' });
            }

            // Fetch all stored entries ordered by newest first
            const selectQuery = `
                SELECT id, package_name, info_33, created_at 
                FROM user_logs33 
                ORDER BY created_at DESC;
            `;
            const result = await pool.query(selectQuery);

            return res.status(200).json({
                success: true,
                totalEntries: result.rowCount,
                logs: result.rows
            });
        } 
        
        else {
            return res.status(405).json({ error: 'Method not allowed' });
        }

    } catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
