import * as cheerio from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';

const BASE_URL = 'https://www.rtmc.co.za';

export const route: Route = {
    path: '/:year?',
    categories: ['traditional-media'],
    example: '/rtmc',
    parameters: {
        year: {
            description: 'Year (e.g. 2026, 2025). Defaults to current year',
        },
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['rtmc.co.za/index.php/publications/press-releases/:year'],
            target: '/:year',
        },
        {
            source: ['rtmc.co.za/'],
            target: '/',
        },
    ],
    name: 'Press Releases',
    maintainers: ['FrancoBenedetti'],
    handler: async (ctx) => {
        const currentYear = new Date().getFullYear().toString();
        const year = ctx.req.param('year') ?? currentYear;

        const targetUrl = `${BASE_URL}/index.php/publications/press-releases/${year}`;
        const html = await ofetch(targetUrl);
        const $ = cheerio.load(html);

        const items: any[] = [];
        $('a[href*="/docs/press_releases/"]').each((_, el) => {
            const $a = $(el);
            const href = $a.attr('href') || '';
            const title = $a.text().trim();
            const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;

            if (title && title.length > 5 && items.every((i) => i.link !== fullUrl)) {
                items.push({
                    title,
                    link: fullUrl,
                    description: `<p><a href="${fullUrl}" target="_blank">Download Press Release PDF: ${title}</a></p>`,
                    guid: fullUrl,
                });
            }
        });

        return {
            title: `RTMC Press Releases ${year}`,
            link: targetUrl,
            description: 'Road Traffic Management Corporation South Africa – Media Releases & Notices',
            item: items,
        };
    },
};
