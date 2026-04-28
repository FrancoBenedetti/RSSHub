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
            feed.items.slice(0, 15).map((item) =>
                cache.tryGet(item.link + ':v8', async () => {
                    try {
                        item.author = 'Maroela Media';
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

                        // Clean up
                        content.find('.verwante-artikels, .ad-banner, script, iframe, .artikel-knoppies-lys, .single-tags').remove();

                        const fullContent = content.html();
                        if (fullContent) {
                            item.description = fullContent;
                        }

                        // Image
                        const image = $('meta[property="og:image"]').attr('content');
                        if (image && item.description && !item.description.includes(image)) {
                            item.description = `<img src="${image}"><br>${item.description}`;
                        }
                    } catch {
                        // Fallback
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
            title: feed.title,
            link: feed.link,
            description: feed.description,
            item: items,
        };
    },
};
