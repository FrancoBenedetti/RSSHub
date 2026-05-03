import Parser from 'rss-parser';

import type { Route } from '@/types';
import puppeteer from '@/utils/puppeteer';

export const route: Route = {
    path: '/topstories',
    categories: ['traditional-media'],
    example: '/news24/topstories',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['news24.com/'],
            target: '/topstories',
        },
    ],
    name: 'Top Stories',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        const url = 'https://feeds.news24.com/articles/news24/TopStories/rss';

        const browser = await puppeteer({ stealth: true });
        const page = await browser.newPage();

        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            if (['document', 'script', 'xhr', 'fetch'].includes(resourceType)) {
                request.continue();
            } else {
                request.abort();
            }
        });

        let xmlContent = '';
        page.on('response', async (response) => {
            if (response.url().includes('TopStories') && response.status() === 200) {
                try {
                    const text = await response.text();
                    if (text.includes('<rss') || text.includes('<feed')) {
                        xmlContent = text;
                    }
                } catch {
                    // Ignore errors reading body
                }
            }
        });

        // Wait for networkidle2 to ensure any Cloudflare JS challenges finish
        const response = await page.goto(url, { waitUntil: 'networkidle2' });

        if (!xmlContent && response) {
            try {
                xmlContent = await response.text();
            } catch {
                // Ignore
            }
        }

        await page.close();
        await browser.close();

        if (!xmlContent || !xmlContent.includes('<rss')) {
            throw new Error('Failed to retrieve valid XML from News24');
        }

        // News24 feed generator frequently omits the required version attribute
        if (xmlContent.includes('<rss') && !xmlContent.includes('version=')) {
            xmlContent = xmlContent.replace('<rss', '<rss version="2.0"');
        }

        const parser = new Parser();
        const feed = await parser.parseString(xmlContent);

        return {
            title: feed.title || 'News24 Top Stories',
            link: feed.link || 'https://www.news24.com',
            description: feed.description || 'News24 Top Stories',
            item: feed.items.map((item) => ({
                title: item.title || '',
                description: item.content || item.contentSnippet || '',
                pubDate: item.pubDate,
                link: item.link || '',
                author: item.creator || item.author,
            })),
        };
    },
};
