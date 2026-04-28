import parser from '@/utils/rss-parser';
import type { Route } from '@/types';

export const route: Route = {
    path: '/latest',
    categories: ['traditional-media'],
    example: '/biznews/latest',
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
            source: ['biznews.com/feed'],
            target: '/latest',
        },
    ],
    name: 'Latest News',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        const feedUrl = 'https://www.biznews.com/feed';
        const feed = await parser.parseURL(feedUrl);

        return {
            title: feed.title,
            link: feed.link,
            description: feed.description,
            item: feed.items.map((item) => ({
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                description: item['content:encoded'] || item.content || item.description,
                author: item.creator,
                category: item.categories,
            })),
        };
    },
};
