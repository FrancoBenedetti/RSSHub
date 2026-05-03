import { load } from 'cheerio';

import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';

export const route: Route = {
    path: '/topstories',
    categories: ['traditional-media'],
    example: '/news24/topstories',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['news24.com/news24/topstories', 'news24.com/topstories', 'news24.com/'],
            target: '/topstories',
        },
    ],
    name: 'Top Stories',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        const baseUrl = 'https://www.news24.com';
        const listUrl = `${baseUrl}/news24/topstories`;

        const response = await ofetch(listUrl, {
            headers: {
                'User-Agent': config.trueUA,
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-ZA,en;q=0.9',
                Referer: 'https://www.google.com/',
            },
            responseType: 'text',
        });

        const $ = load(response);

        // Deduplicate by link - each article card appears multiple times in the DOM
        const seen = new Set<string>();
        const articleLinks: Array<{ href: string; title: string; category: string }> = [];

        $('a.js-article-link').each((_, el) => {
            const href = $(el).attr('href');
            const title = $(el).find('span.js-article-title').text().trim();
            if (!href || !title || seen.has(href)) {
                return;
            }
            seen.add(href);
            const articleEl = $(el).closest('article');
            const category = articleEl.find('.category-name').first().text().trim();
            articleLinks.push({ href, title, category });
        });

        const items = await Promise.all(
            articleLinks.slice(0, 20).map(({ href, title, category }) => {
                const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
                return cache.tryGet(link + ':v3', async () => {
                    try {
                        const articleHtml = await ofetch(link, {
                            headers: {
                                'User-Agent': config.trueUA,
                                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                'Accept-Language': 'en-ZA,en;q=0.9',
                                Referer: listUrl,
                            },
                            responseType: 'text',
                        });
                        const $a = load(articleHtml);

                        // Extract article body — confirmed selector against live News24 HTML
                        const content = $a('.article__body').first();
                        content.find('script, style, iframe, .article__share, .article__related, .article__footer, .ad, nav').remove();

                        // article:published_time meta is absent on News24; extract from JSON-LD instead
                        const jsonLdMatch = articleHtml.match(/"datePublished"\s*:\s*"([^"]+)"/);
                        const pubDateStr = jsonLdMatch?.[1];

                        // Extract og:image and og:description (used as fallback for paywalled articles)
                        const image = $a('meta[property="og:image"]').attr('content');
                        const ogDesc = $a('meta[property="og:description"]').attr('content') || $a('meta[name="description"]').attr('content');
                        // Paywalled articles (e.g. CityPress) return an empty .article__body
                        let description = content.html() || '';
                        if (!description && ogDesc) {
                            description = `<p>${ogDesc}</p>`;
                        }
                        if (image && !description.includes(image)) {
                            description = `<img src="${image}"><br>${description}`;
                        }

                        return {
                            title,
                            link,
                            description,
                            pubDate: pubDateStr ? new Date(pubDateStr).toUTCString() : undefined,
                            category: category ? [category] : undefined,
                        };
                    } catch {
                        // Fallback: return with title and link only
                        return {
                            title,
                            link,
                            description: '',
                            category: category ? [category] : undefined,
                        };
                    }
                });
            })
        );

        return {
            title: 'News24 Top Stories',
            link: listUrl,
            description: 'Top Stories from News24 South Africa',
            item: items,
        };
    },
};
