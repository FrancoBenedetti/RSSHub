import { load } from 'cheerio';

import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import parser from '@/utils/rss-parser';

export const route: Route = {
    path: '/nuus',
    categories: ['traditional-media'],
    example: '/tlu/nuus',
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
            source: ['tlu.co.za/nuus'],
            target: '/nuus',
        },
    ],
    name: 'Nuus',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        const feedUrl = 'https://www.tlu.co.za/feed/';
        const feed = await parser.parseURL(feedUrl);

        const items = await Promise.all(
            feed.items.slice(0, 20).map((item) =>
                cache.tryGet(item.link + ':v1', async () => {
                    try {
                        const response = await ofetch(item.link, {
                            headers: {
                                'User-Agent': config.trueUA,
                            },
                        });
                        const $ = load(response);

                        // Extract content from WordPress post
                        const content = $('.entry-content').html() || item.content || item.contentSnippet;

                        return {
                            title: item.title,
                            link: item.link,
                            description: content,
                            pubDate: item.pubDate,
                            author: item.creator || item.author,
                            category: item.categories,
                        };
                    } catch (e) {
                        return {
                            title: item.title,
                            link: item.link,
                            description: item.content || item.contentSnippet || item.title,
                            pubDate: item.pubDate,
                        };
                    }
                })
            )
        );

        return {
            title: 'TLU SA - Nuus',
            link: 'https://www.tlu.co.za/nuus/',
            item: items,
        };
    },
};
