import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog',
    categories: ['blog'],
    example: '/safetyhub/blog',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportRadar: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['safetyhub.com/blog', 'safetyhub.com/en-gb/'],
            target: '/blog',
        },
    ],
    name: 'Blog',
    maintainers: ['FrancoBenedetti'],
    handler: async (ctx) => {
        const baseUrl = 'https://www.safetyhub.com';
        const limitQuery = ctx.req.query('limit');
        const limit = limitQuery ? Number.parseInt(limitQuery) : 20;

        const data = await ofetch(`${baseUrl}/wp-json/wp/v2/posts`, {
            query: {
                per_page: limit,
            },
        });

        const items = data.map((item) => ({
            title: item.title?.rendered ?? '',
            description: item.content.rendered,
            pubDate: parseDate(item.date_gmt),
            link: item.link,
            guid: item.guid.rendered,
        }));

        return {
            title: 'Safety Hub Blog',
            link: `${baseUrl}/blog/`,
            description: 'The Safety Hub blog provides workplace safety training resources and insights.',
            item: items,
        };
    },
};
