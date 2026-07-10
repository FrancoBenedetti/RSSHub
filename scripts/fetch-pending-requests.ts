/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';
import { ofetch } from 'ofetch';

// Load environment variables from .env.db
dotenv.config({ path: path.resolve(process.cwd(), '.env.db') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!serviceRoleKey) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY is not defined in .env.db or .env');
    process.exit(1);
}

// Extract project ref from DATABASE_URL or fallback to the current one
let projectRef = 'nnmqmwuwndkatzxjbkmm';
if (databaseUrl) {
    const match = databaseUrl.match(/db\.(.*?)\.supabase\.co/);
    if (match && match[1]) {
        projectRef = match[1];
    }
}

const url = `https://${projectRef}.supabase.co/rest/v1/route_requests?status=eq.pending`;

console.log(`Fetching pending route requests from project ref: ${projectRef}...`);

try {
    const data = await ofetch(url, {
        method: 'GET',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
        },
    });

    const scratchDir = path.resolve(process.cwd(), 'scratch');
    if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir);
    }

    const targetFile = path.join(scratchDir, 'pending_requests.json');
    fs.writeFileSync(targetFile, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Successfully wrote ${data.length} pending requests to scratch/pending_requests.json`);
} catch (error) {
    console.error('Failed to fetch pending requests:', error);
    process.exit(1);
}
