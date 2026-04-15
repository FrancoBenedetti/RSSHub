import { namespaces } from '@/registry';
import type { APIRoute } from '@/types';

export const apiRoute: APIRoute = {
    path: '/find',
    categories: ['program-update'],
    example: '/api/rsshub/find?s=lexlibertas',
    parameters: {
        s: 'Namespace search string',
    },
    name: 'Find Routes',
    maintainers: ['FrancoBenedetti'],
    handler: (ctx) => {
        const query = (ctx.req.query('s') || '').toLowerCase();

        const filtered = Object.entries(namespaces)
            .filter(([namespace, data]) => namespace.toLowerCase().includes(query) || (data.name && data.name.toLowerCase().includes(query)))
            .reduce((obj, [namespace, data]) => {
                obj[namespace] = {
                    name: data.name,
                    routes: Object.keys(data.routes || {}),
                };
                return obj;
            }, {});

        return filtered;
    },
};
