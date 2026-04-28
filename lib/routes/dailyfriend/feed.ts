import { load } from 'cheerio';

import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import parser from '@/utils/rss-parser';

export const route: Route = {
    path: '/:category?',
    categories: ['traditional-media'],
    example: '/dailyfriend',
    parameters: {
        category: {
            description: 'Category slug (e.g., `politics`, `economics`). Leave empty for the main feed.',
        },
    },
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
            source: ['dailyfriend.co.za/category/:category/'],
            target: '/:category',
        },
        {
            source: ['dailyfriend.co.za/'],
            target: '/',
        },
    ],
    name: 'Articles & Analysis',
    maintainers: ['FrancoBenedetti'],
    handler: async (ctx) => {
        const category = ctx.req.param('category');
        const feedUrl = category ? `https://dailyfriend.co.za/category/${category}/feed/` : 'https://dailyfriend.co.za/feed/';

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
                        content.find('script, iframe, .sharedaddy, .jp-relatedposts, .wpcnt, nav, .navigation, .related-posts').remove();

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
            title: feed.title ?? 'Daily Friend',
            link: 'https://dailyfriend.co.za',
            description: feed.description ?? 'The Daily Friend - South African news, analysis and opinion',
            item: items,
        };
    },
};
