import { load } from 'cheerio';

import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import parser from '@/utils/rss-parser';

export const route: Route = {
    path: '/feed',
    categories: ['traditional-media'],
    example: '/ruggas/feed',
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
            source: ['ruggas.co.za/feed', 'ruggas.co.za/'],
            target: '/feed',
        },
    ],
    name: 'Feed',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        const feedUrl = 'https://ruggas.co.za/feed/';
        const feed = await parser.parseURL(feedUrl);

        const items = await Promise.all(
            feed.items.slice(0, 20).map((item) =>
                cache.tryGet((item.link ?? '') + ':v1', async () => {
                    try {
                        if (item.link) {
                            const response = await ofetch(item.link, {
                                headers: {
                                    'User-Agent': config.trueUA,
                                },
                            });
                            const $ = load(response);

                            // Extract content from WordPress post
                            const content = $('.entry-content').html() || item.content || item.contentSnippet;

                            return {
                                title: item.title ?? '',
                                link: item.link,
                                description: content,
                                pubDate: item.pubDate,
                                author: item.creator || item.author,
                                category: item.categories,
                            };
                        }
                    } catch {
                        // Fallback
                    }
                    return {
                        title: item.title ?? '',
                        link: item.link,
                        description: item.content || item.contentSnippet || item.title,
                        pubDate: item.pubDate,
                        author: item.creator || item.author,
                        category: item.categories,
                    };
                })
            )
        );

        return {
            title: 'Ruggas.co.za',
            link: 'https://ruggas.co.za',
            description: 'Ruggas - Skolerugby Nuus',
            item: items,
        };
    },
};
