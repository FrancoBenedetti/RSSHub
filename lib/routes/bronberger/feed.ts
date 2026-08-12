import { load } from 'cheerio';
import Parser from 'rss-parser';

import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const BASE_URL = 'https://www.bronberger.co.za';

const CATEGORY_MAP: Record<string, { id: number; label: string }> = {
    aktueel: { id: 55, label: 'Aktueel' },
    briewe: { id: 54, label: 'Briewe' },
    'het-jy-gehoor': { id: 56, label: 'Het Jy Gehoor' },
    kommentaar: { id: 60, label: 'Kommentaar' },
    artikels: { id: 57, label: 'Artikels' },
    rubrieke: { id: 61, label: 'Rubrieke' },
    vreethans: { id: 53, label: 'Vreethans' },
    mymerkos: { id: 69, label: 'Mymerkos' },
    'ons-mense': { id: 49, label: 'Ons Mense' },
    'ons-omgewing': { id: 59, label: 'Ons Omgewing' },
    'toeka-se-dae': { id: 50, label: 'Toeka se dae' },
    'ou-poon-se-plotpraatjies': { id: 52, label: 'Ou Poon se plotpraatjies' },
    'final-word': { id: 51, label: 'Final Word' },
    'ons-voorblad': { id: 67, label: 'Ons Voorblad' },
};

interface FeedItem {
    title: string;
    link: string;
    pubDate?: string;
    category?: string[];
    author?: string;
    description?: string;
}

export const route: Route = {
    path: '/:category?',
    categories: ['traditional-media'],
    example: '/bronberger/aktueel',
    parameters: {
        category: {
            description: 'Kategorie / Category slug. Los leeg vir alle nuutste berigte.',
            options: Object.entries(CATEGORY_MAP).map(([value, info]) => ({
                value,
                label: info.label,
            })),
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
            source: ['www.bronberger.co.za/index.php'],
            target: '/:category',
        },
        {
            source: ['www.bronberger.co.za/'],
            target: '/',
        },
    ],
    name: 'Berigte / Category Feed',
    maintainers: ['FrancoBenedetti'],
    handler: async (ctx) => {
        const categorySlug = ctx.req.param('category');
        const categoryInfo = categorySlug ? CATEGORY_MAP[categorySlug] : undefined;

        const feedItems: FeedItem[] = [];
        let channelTitle = 'Die Bronberger';
        let channelLink = BASE_URL;

        if (categoryInfo) {
            const feedUrl = `${BASE_URL}/index.php?option=com_content&view=category&id=${categoryInfo.id}&format=feed&type=rss`;
            const parser = new Parser({
                headers: {
                    'User-Agent': config.trueUA,
                },
            });
            const feed = await parser.parseURL(feedUrl);
            channelTitle = `Die Bronberger - ${categoryInfo.label}`;
            channelLink = `${BASE_URL}/index.php?option=com_content&view=category&id=${categoryInfo.id}`;

            for (const item of feed.items) {
                if (item.link && item.title) {
                    feedItems.push({
                        title: item.title,
                        link: item.link,
                        pubDate: item.pubDate,
                        category: item.categories ?? [categoryInfo.label],
                        author: item.creator || 'Die Bronberger',
                    });
                }
            }
        } else {
            // Homepage latest news scraping
            const html = await ofetch(`${BASE_URL}/index.php`, {
                headers: {
                    'User-Agent': config.trueUA,
                },
            });
            const $ = load(html);

            $('a.latestnews').each((_, el) => {
                const href = $(el).attr('href');
                const title = $(el).text().trim();
                if (href && title) {
                    const fullLink = new URL(href, BASE_URL).href;
                    feedItems.push({
                        title,
                        link: fullLink,
                        author: 'Die Bronberger',
                    });
                }
            });
        }

        const items = await Promise.all(
            feedItems.map(async (item) => {
                try {
                    return await cache.tryGet(item.link + ':v1', async () => {
                        const response = await ofetch(item.link, {
                            headers: {
                                'User-Agent': config.trueUA,
                            },
                        });
                        const $ = load(response);

                        const scrapedTitle = $('.contentheading').first().text().trim();
                        const scrapedCategory = $('.contentpaneopen span').last().text().trim();
                        const createDateText = $('.createdate').first().text().trim();

                        const bodyTd = $('.createdate').closest('tr').next('tr').find('td[valign="top"]').first();
                        if (bodyTd.length > 0) {
                            bodyTd.find('script, iframe, style').remove();

                            bodyTd.find('img').each((_, img) => {
                                const src = $(img).attr('src');
                                if (src) {
                                    $(img).attr('src', new URL(src, BASE_URL).href);
                                }
                            });
                        }

                        let description = bodyTd.length > 0 ? bodyTd.html() || '' : '';

                        let image: string | undefined;
                        const firstImg = bodyTd.find('img').first().attr('src');
                        if (firstImg) {
                            image = firstImg;
                        } else {
                            const ogImg = $('meta[property="og:image"]').attr('content');
                            if (ogImg) {
                                image = new URL(ogImg, BASE_URL).href;
                            }
                        }

                        if (image && description && !description.includes(image)) {
                            description = `<img src="${image}"><br>${description}`;
                        }

                        if (!description) {
                            throw new Error('Failed to extract full description');
                        }

                        const pubDate = createDateText ? parseDate(createDateText) : item.pubDate ? parseDate(item.pubDate) : undefined;
                        const categories = scrapedCategory ? [scrapedCategory] : item.category;

                        return {
                            title: scrapedTitle || item.title,
                            link: item.link,
                            description,
                            pubDate,
                            author: item.author || 'Die Bronberger',
                            category: categories,
                            image,
                            media: image
                                ? {
                                      content: {
                                          url: image,
                                          medium: 'image',
                                      },
                                  }
                                : undefined,
                        };
                    });
                } catch {
                    return {
                        title: item.title,
                        link: item.link,
                        description: item.description || item.title,
                        pubDate: item.pubDate ? parseDate(item.pubDate) : undefined,
                        author: item.author || 'Die Bronberger',
                        category: item.category,
                    };
                }
            })
        );

        return {
            title: channelTitle,
            link: channelLink,
            description: 'Die Bronberger - Plaaslike nuus vir die Ooste van Pretoria',
            language: 'af',
            item: items,
        };
    },
};
