import type { Route } from '@/types';
import parser from '@/utils/rss-parser';

export const route: Route = {
    path: '/topstories',
    categories: ['traditional-media'],
    example: '/news24/topstories',
    parameters: {},
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
            source: ['news24.com/news24/topstories', 'news24.com/topstories', 'news24.com/'],
            target: '/topstories',
        },
    ],
    name: 'Top Stories',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        // news24.com blocks all direct scraping (403 via Cloudflare WAF).
        // Use Google News RSS as a reliable proxy for News24 top stories.
        const feedUrl = 'https://news.google.com/rss/search?q=site:news24.com&hl=en-ZA&gl=ZA&ceid=ZA:en';
        const feed = await parser.parseURL(feedUrl);

        return {
            title: 'News24 Top Stories',
            link: 'https://www.news24.com/news24/topstories',
            description: 'Top Stories from News24 South Africa via Google News',
            item: feed.items.map((item) => ({
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                author: item.creator,
                category: item.categories,
                description: item['content:encoded'] || item.content || item.description || item.contentSnippet,
            })),
        };
    },
};
