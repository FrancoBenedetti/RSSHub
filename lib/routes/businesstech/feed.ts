import { load } from 'cheerio';
import parser from '@/utils/rss-parser';
import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';

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
        const feedUrl = 'https://businesstech.co.za/news/feed/';
        const feed = await parser.parseURL(feedUrl);

        const items = await Promise.all(
            feed.items.map((item) =>
                cache.tryGet(item.link + ':v1', async () => {
                    try {
                        const response = await ofetch(item.link, {
                            headers: {
                                'User-Agent': config.trueUA,
                            },
                        });
                        const $ = load(response);

                        // Clean up
                        $('.entry-header').remove();
                        $('.newsletter-subscribe').remove();
                        $('.show-comments').remove();
                        $('.comments').remove();

                        const description = $('.entry-content').html();

                        return {
                            title: item.title,
                            link: item.link,
                            pubDate: item.pubDate,
                            description,
                            author: item.creator,
                            category: item.categories,
                        };
                    } catch (e) {
                        return {
                            title: item.title,
                            link: item.link,
                            pubDate: item.pubDate,
                            description: item.contentSnippet || item.description,
                        };
                    }
                })
            )
        );

        return {
            title: feed.title,
            link: feed.link,
            description: feed.description,
            item: items,
        };
    },
};
