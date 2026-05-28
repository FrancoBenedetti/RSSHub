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
                cache.tryGet(item.link + ':v10', async () => {
                    // Extract WordPress post ID from the GUID URL (e.g. https://maroelamedia.co.za/?p=784111)
                    const postId = item.guid?.match(/[?&]p=(\d+)/)?.[1];

                    // Fallback: use the RSS snippet if the API call fails
                    let description: string | undefined = item.content || item.contentSnippet;
                    let image: string | undefined;
                    let enclosureType = 'image/jpeg';

                    if (postId) {
                        try {
                            const post = await ofetch(`https://maroelamedia.co.za/wp-json/wp/v2/posts/${postId}?_embed=wp:featuredmedia`, {
                                headers: { 'User-Agent': config.trueUA },
                            });

                            // Full article content — clean up unwanted elements
                            if (post.content?.rendered) {
                                const $ = load(post.content.rendered);
                                $('.verwante-artikels, .ad-banner, script, iframe, .artikel-knoppies-lys, .single-tags').remove();
                                description = $.html();
                            }

                            // Full-resolution featured image from the embedded media object
                            const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
                            if (featuredMedia?.source_url) {
                                image = featuredMedia.source_url;
                                enclosureType = featuredMedia.mime_type || 'image/jpeg';
                            }

                            // Prepend image to description if not already present
                            if (image && description && !description.includes(image)) {
                                description = `<img src="${image}"><br>${description}`;
                            }
                        } catch {
                            // Keep fallback values from the RSS feed
                        }
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
                                      type: enclosureType,
                                      medium: 'image',
                                  },
                              }
                            : undefined,
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
