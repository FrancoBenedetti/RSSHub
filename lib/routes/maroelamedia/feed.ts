import { load } from 'cheerio';

import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
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

        // Fast path: use the WP REST API to fetch 15 articles in a single request.
        // This avoids the 429 Too Many Requests errors caused by fetching 15 pages/APIs concurrently.
        try {
            let categoryId: number | undefined;
            if (category) {
                categoryId = await cache.tryGet(`maroelamedia:category:${category}`, async () => {
                    const cats = await ofetch(`https://maroelamedia.co.za/wp-json/wp/v2/categories?slug=${category}`, {
                        headers: { 'User-Agent': config.trueUA },
                    });
                    return cats?.[0]?.id;
                });
                if (!categoryId) {
                    throw new Error(`Category ${category} not found`);
                }
            }

            const postsUrl = new URL('https://maroelamedia.co.za/wp-json/wp/v2/posts');
            postsUrl.searchParams.append('per_page', '15');
            postsUrl.searchParams.append('_embed', '1');
            if (categoryId) {
                postsUrl.searchParams.append('categories', categoryId.toString());
            }

            const posts = await ofetch(postsUrl.toString(), {
                headers: { 'User-Agent': config.trueUA },
            });

            const items = posts.map((post) => {
                let description = post.content?.rendered || '';
                let image: string | undefined;
                let enclosureType = 'image/jpeg';

                if (description) {
                    const $ = load(description);
                    $('.verwante-artikels, .ad-banner, script, iframe, .artikel-knoppies-lys, .single-tags').remove();
                    description = $.html();
                }

                const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
                if (featuredMedia?.source_url) {
                    image = featuredMedia.source_url;
                    enclosureType = featuredMedia.mime_type || 'image/jpeg';
                }

                if (image && description && !description.includes(image)) {
                    description = `<img src="${image}"><br>${description}`;
                }

                const categories: string[] = [];
                const terms = post._embedded?.['wp:term'] || [];
                for (const termGroup of terms) {
                    for (const t of termGroup) {
                        if (t.taxonomy === 'category' || t.taxonomy === 'post_tag') {
                            categories.push(t.name);
                        }
                    }
                }

                const author = post._embedded?.author?.[0]?.name || 'Maroela Media';

                return {
                    title: post.title?.rendered,
                    link: post.link,
                    description,
                    pubDate: parseDate(post.date_gmt || post.date),
                    author,
                    category: categories,
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
            });

            return {
                title: `Nuus | Maroela Media${category ? ` - ${category}` : ''}`,
                link: category ? `https://maroelamedia.co.za/kategorie/${category}/` : 'https://maroelamedia.co.za/',
                description: 'gratis Afrikaanse nuus en kuierplek - gebalanseerd en betroubaar - Powered by RSSHub',
                item: items,
            };
        } catch {
            // Fallback: If WP API is blocked or errors out, fallback to the standard RSS feed parsing.
            // This guarantees the route won't crash, even if images/full text are missing.
            const feedUrl = category ? `https://maroelamedia.co.za/kategorie/${category}/feed/` : 'https://maroelamedia.co.za/feed/';
            const feed = await parser.parseURL(feedUrl);

            return {
                title: feed.title,
                link: feed.link,
                description: feed.description,
                item: feed.items.map((item) => ({
                    title: item.title,
                    link: item.link,
                    description: item.content || item.contentSnippet,
                    pubDate: item.pubDate,
                    author: item.creator || 'Maroela Media',
                    category: item.categories,
                })),
            };
        }
    },
};
