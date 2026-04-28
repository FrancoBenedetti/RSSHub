import { load } from 'cheerio';

import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import parser from '@/utils/rss-parser';

export const route: Route = {
    path: '/',
    categories: ['traditional-media'],
    example: '/fak',
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
            source: ['fak.org.za/', 'fak.org.za/nuus/', 'fak.org.za/nuus/*'],
            target: '/',
        },
    ],
    name: 'Nuus / News Feed',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        const feedUrl = 'https://fak.org.za/feed/';

        const feed = await parser.parseURL(feedUrl);

        const items = await Promise.all(
            feed.items.slice(0, 15).map((item) =>
                cache.tryGet(item.link + ':v1', async () => {
                    try {
                        const response = await ofetch(item.link, {
                            headers: {
                                'User-Agent': config.trueUA,
                            },
                        });
                        const $ = load(response);

                        let content = $('.entry-content, [itemprop="articleBody"], .post-content').first();

                        if (!content.length) {
                            content = $('article');
                        }

                        // Clean up non-content elements
                        content.find('script, iframe, .sharedaddy, .jp-relatedposts, .wpcnt, nav, .navigation').remove();

                        const fullContent = content.html();
                        if (fullContent) {
                            item.description = fullContent;
                        }

                        const image = $('meta[property="og:image"]').attr('content');
                        if (image && item.description && !item.description.includes(image)) {
                            item.description = `<img src="${image}"><br>${item.description}`;
                        }
                    } catch {
                        // Fallback to feed description
                    }
                    return {
                        title: item.title,
                        link: item.link,
                        description: item.description,
                        pubDate: item.pubDate,
                        author: item.author,
                        category: item.category,
                    };
                })
            )
        );

        return {
            title: feed.title ?? 'FAK',
            link: 'https://fak.org.za',
            description: feed.description ?? 'Federasie van Afrikaanse Kultuurvereniginge - Nuus',
            item: items,
        };
    },
};
