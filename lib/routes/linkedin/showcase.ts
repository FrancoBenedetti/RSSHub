import { load } from 'cheerio';

import type { Route } from '@/types';
import logger from '@/utils/logger';
import playwright from '@/utils/playwright';

import { BASE_URL, parseCompanyName, parseCompanyPosts } from './utils';

export const route: Route = {
    path: '/showcase/:showcase_id/posts',
    categories: ['social-media'],
    example: '/linkedin/showcase/national-safety-council-work-to-zero-program/posts',
    parameters: { showcase_id: "Showcase's LinkedIn profile ID" },
    description: "Get showcase's LinkedIn posts by showcase ID",
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: false,
        supportRadar: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: 'Showcase Posts',
    maintainers: ['FrancoBenedetti'],
    handler: async (ctx) => {
        const showcase_id = ctx.req.param('showcase_id');

        // Puppeteer setup
        const context = await playwright();
        const page = await context.newPage();
        await page.route('**/*', (route) => {
            const request = route.request();
            request.resourceType() === 'document' ? route.continue() : route.abort();
        });

        const url = new URL(`${BASE_URL}/showcase/${showcase_id}`);

        logger.http(`Requesting ${url.href}`);
        await page.goto(url.href, {
            waitUntil: 'domcontentloaded',
        });

        const response = await page.content();
        await page.close();

        const $ = load(response);
        const showcaseName = parseCompanyName($);
        const posts = parseCompanyPosts($);

        await context.close();

        return {
            title: `LinkedIn - ${showcaseName}'s Posts`,
            link: url.href,
            description: `This feed gets ${showcaseName}'s posts from LinkedIn`,
            item: posts.map((post) => ({
                title: post.text,
                description: post.text,
                link: post.link,
                pubDate: post.date,
                updated: post.date,
            })),
        };
    },
};
