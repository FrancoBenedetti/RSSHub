import type { Route } from '@/types';
import parser from '@/utils/rss-parser';

export const route: Route = {
    path: '/latest',
    categories: ['traditional-media'],
    example: '/dailyinvestor/latest',
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
            source: ['dailyinvestor.com/feed'],
            target: '/latest',
        },
    ],
    name: 'Latest News',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        // dailyinvestor.com blocks Vercel datacenter IPs (Cloudflare WAF).
        // Use Google News RSS as a reliable proxy instead.
        const feedUrl = 'https://news.google.com/rss/search?q=site:dailyinvestor.com&hl=en-ZA&gl=ZA&ceid=ZA:en';
        const feed = await parser.parseURL(feedUrl);

        return {
            title: 'Daily Investor Latest News',
            link: 'https://dailyinvestor.com/',
            description: 'Latest investment and business news from Daily Investor South Africa via Google News',
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
