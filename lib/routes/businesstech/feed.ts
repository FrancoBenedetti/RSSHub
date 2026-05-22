import type { Route } from '@/types';
import parser from '@/utils/rss-parser';

export const route: Route = {
    path: '/news',
    categories: ['traditional-media'],
    example: '/businesstech/news',
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
            source: ['businesstech.co.za/news'],
            target: '/news',
        },
    ],
    name: 'Latest News',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        // businesstech.co.za blocks Vercel datacenter IPs (Cloudflare WAF).
        // Use Google News RSS as a reliable proxy instead.
        const feedUrl = 'https://news.google.com/rss/search?q=site:businesstech.co.za&hl=en-ZA&gl=ZA&ceid=ZA:en';
        const feed = await parser.parseURL(feedUrl);

        return {
            title: 'BusinessTech Latest News',
            link: 'https://businesstech.co.za/news/',
            description: 'Latest tech and business news from BusinessTech South Africa via Google News',
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
