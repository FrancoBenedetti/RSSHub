import { load } from 'cheerio';

import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import parser from '@/utils/rss-parser';

export const route: Route = {
    path: '/:category?',
    categories: ['traditional-media'],
    example: '/maroelamedia/nuus',
    parameters: {
        category: {
            description: 'Category name (e.g., `nuus`, `vermaak`). Leave empty for the main feed.',
            options: [
                { value: 'nuus', label: 'Nuus' },
                { value: 'vermaak', label: 'Vermaak' },
                { value: 'kos', label: 'Kos' },
                { value: 'leefstyl', label: 'Leefstyl' },
                { value: 'tegnologie', label: 'Tegnologie' },
                { value: 'boeke', label: 'Boeke' },
                { value: 'motor', label: 'Motor' },
                { value: 'buitelug', label: 'Buitelug' },
                { value: 'briewe', label: 'Briewe' },
                { value: 'goeiegoed', label: 'Goeie Goed' },
                { value: 'radionuus', label: 'Radio Nuus' },
            ],
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
            source: ['maroelamedia.co.za/kategorie/:category/'],
            target: '/:category',
        },
        {
            source: ['maroelamedia.co.za/'],
            target: '/',
        },
    ],
    name: 'Berigte / Category Feed',
    maintainers: ['FrancoBenedetti'],
    handler: async (ctx) => {
        const category = ctx.req.param('category');
        const feedUrl = category ? `https://maroelamedia.co.za/kategorie/${category}/feed/` : 'https://maroelamedia.co.za/feed/';

        const feed = await parser.parseURL(feedUrl);

        const items = await Promise.all(
            feed.items.slice(0, 15).map(async (item) => {
                try {
                    // We throw errors inside tryGet if scraping fails.
                    // This ensures that failed fetches (like 429 rate limits during a cold cache stampede)
                    // are NOT cached forever. The outer catch block handles the fallback to the RSS snippet.
                    return await cache.tryGet(item.link + ':v14', async () => {
                        const response = await ofetch(item.link, {
                            headers: {
                                'User-Agent': config.trueUA,
                            },
                        });
                        const $ = load(response);

                        let content = $('.entry-content, [itemprop="articleBody"], .post-content').first();

                        if (!content.length) {
                            content = $('article section').first();
                        }
                        if (!content.length) {
                            content = $('article');
                        }

                        // Clean up unwanted elements
                        content.find('.verwante-artikels, .ad-banner, script, iframe, .artikel-knoppies-lys, .single-tags').remove();

                        let description = content.html() || '';

                        // Image extraction
                        const image = $('meta[property="og:image"]').attr('content');
                        if (image && description && !description.includes(image)) {
                            description = `<img src="${image}"><br>${description}`;
                        }

                        if (!description) {
                            throw new Error('Failed to extract full description');
                        }

                        return {
                            title: item.title,
                            link: item.link,
                            description,
                            pubDate: item.pubDate,
                            author: item.creator || 'Maroela Media',
                            category: item.categories,
                            image,
                            media: image
                                ? {
                                      content: {
                                          url: image,
                                          type: 'image/jpeg',
                                          medium: 'image',
                                      },
                                  }
                                : undefined,
                        };
                    });
                } catch {
                    // Fallback block outside tryGet: If fetching fails, return the RSS snippet.
                    // Since it's outside tryGet, this fallback snippet is NOT cached and will be retried later.
                    return {
                        title: item.title,
                        link: item.link,
                        description: item.content || item.contentSnippet,
                        pubDate: item.pubDate,
                        author: item.creator || 'Maroela Media',
                        category: item.categories,
                    };
                }
            })
        );

        return {
            title: feed.title,
            link: feed.link,
            description: feed.description,
            item: items,
        };
    },
};
