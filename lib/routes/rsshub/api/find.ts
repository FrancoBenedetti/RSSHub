import fs from 'node:fs';
import path from 'node:path';

import type { APIRoute } from '@/types';

// Read the lightweight index at startup (once)
let routeIndex: any = null;
try {
    const indexPath = path.join(import.meta.dirname, '../../../../assets/build/route-index.json');
    routeIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
} catch {
    // Fallback if index isn't built
    routeIndex = { searchKeys: [], namespaces: {} };
}

export const apiRoute: APIRoute = {
    path: '/find',
    categories: ['program-update'],
    example: '/api/rsshub/find?s=lexlibertas',
    parameters: {
        s: 'Namespace search string (matches namespace key, name, or URL)',
    },
    name: 'Find Routes',
    maintainers: ['FrancoBenedetti'],
    handler: (ctx) => {
        const query = (ctx.req.query('s') || '').toLowerCase();

        if (!query || !routeIndex) {
            return {};
        }

        const results: Record<string, any> = {};

        for (const item of routeIndex.searchKeys) {
            if (item.key.toLowerCase().includes(query) || (item.name && item.name.toLowerCase().includes(query)) || (item.url && item.url.toLowerCase().includes(query))) {
                results[item.key] = routeIndex.namespaces[item.key];
            }
        }

        return results;
    },
};
