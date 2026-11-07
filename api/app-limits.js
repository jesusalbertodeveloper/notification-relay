import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    prepareThreshold: 0
});

async function ensureTableExists() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS app_time_limits (
            package_name VARCHAR(255) PRIMARY KEY,
            limit_millis BIGINT DEFAULT 0,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
    `);
}

export default async function handler(req, res) {
    try {
        await ensureTableExists();

        // Asegurar que req.body esté parseado como JSON si viene como texto
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { body = {}; }
        }

        // Dentro de tu handler GET en Vercel:
if (req.method === 'GET') {
    // Esto asegura que devuelva todos los paquetes conocidos y su límite (o null si no tienen)
    const result = await pool.query(`
        SELECT package_name, limit_millis 
        FROM app_time_limits 
        ORDER BY package_name ASC
    `);
    return res.status(200).json({ success: true, apps: result.rows });
}

        if (req.method === 'POST') {
            const { packages, packageName, limitMillis } = body || {};

            // Scenario A: Bulk sync eficiente usando UNNEST (1 sola consulta SQL)
            if (Array.isArray(packages) && packages.length > 0) {
                await pool.query(`
                    INSERT INTO app_time_limits (package_name, limit_millis, updated_at)
                    SELECT unnest($1::text[]), 0, timezone('utc'::text, now())
                    ON CONFLICT (package_name) DO NOTHING
                `, [packages]);

                return res.status(200).json({ success: true, message: `Synced ${packages.length} apps successfully.` });
            }

            // Scenario B: Setting/updating a time limit for a specific package
            if (packageName && limitMillis !== undefined) {
                await pool.query(`
                    INSERT INTO app_time_limits (package_name, limit_millis, updated_at)
                    VALUES ($1, $2, timezone('utc'::text, now()))
                    ON CONFLICT (package_name) 
                    DO UPDATE SET limit_millis = EXCLUDED.limit_millis, updated_at = EXCLUDED.updated_at
                `, [packageName, limitMillis]);

                return res.status(200).json({ success: true, message: `Time limit saved for ${packageName}` });
            }

            return res.status(400).json({ success: false, error: 'Invalid request payload parameters' });
        }

        if (req.method === 'DELETE') {
            const { packageName } = body || req.query;
            if (!packageName) {
                return res.status(400).json({ success: false, error: 'Package name is required' });
            }

            await pool.query('DELETE FROM app_time_limits WHERE package_name = $1', [packageName]);
            return res.status(200).json({ success: true, message: `Removed limit for ${packageName}` });
        }

        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });

    } catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
