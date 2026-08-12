import * as cheerio from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const BASE_URL = 'https://www.globalfleet.com';

export const route: Route = {
    path: '/:category?',
    categories: ['traditional-media'],
    example: '/globalfleet',
    parameters: {
        category: {
            description: 'Category slug (optional, e.g. news)',
        },
    },
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
            source: ['globalfleet.com/en/news'],
            target: '/',
        },
        {
            source: ['globalfleet.com/en/:category'],
            target: '/:category',
        },
    ],
    name: 'Latest News',
    maintainers: ['FrancoBenedetti'],
    handler: async (ctx) => {
        const category = ctx.req.param('category') ?? 'news';
        const targetUrl = `${BASE_URL}/en/${category}`;

        const html: string = await ofetch(targetUrl);
        const $ = cheerio.load(html);

        const list: Array<{ title: string; link: string }> = [];
        $('a[href*="/article/"], a[href*="/features/"]').each((_, el) => {
            const $a = $(el);
            const href = $a.attr('href') || '';
            const title = $a.text().trim();
            const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;

            if (title && title.length > 10 && list.every((item) => item.link !== fullUrl)) {
                list.push({ title, link: fullUrl });
            }
        });

        const uniqueItems = list.slice(0, 20);

        const items = await Promise.all(
            uniqueItems.map((item) =>
                cache.tryGet(item.link + ':v1', async () => {
                    try {
                        const articleHtml: string = await ofetch(item.link);
                        const $article = cheerio.load(articleHtml);

                        const title = $article('h1').first().text().trim() || item.title;
                        const $content = $article('.node__content, article, .field--name-body').first();

                        $content.find('script, style, .social-share').remove();

                        const imgUrl = $article('meta[property="og:image"]').attr('content') || $content.find('img').first().attr('src');
                        const fullImgUrl = imgUrl ? (imgUrl.startsWith('http') ? imgUrl : `${BASE_URL}${imgUrl}`) : undefined;

                        let description = $content.html() || item.title;
                        if (fullImgUrl && !description.includes(fullImgUrl)) {
                            description = `<img src="${fullImgUrl}" alt="${title}">\n${description}`;
                        }

                        const dateStr = $article('meta[property="article:published_time"]').attr('content') || $article('.submitted, .date, time').first().text().trim();
                        const pubDate = dateStr ? parseDate(dateStr) : undefined;

                        return {
                            title,
                            link: item.link,
                            description,
                            pubDate,
                            guid: item.link,
                            image: fullImgUrl,
                            media: fullImgUrl
                                ? {
                                      content: {
                                          url: fullImgUrl,
                                          medium: 'image',
                                      },
                                  }
                                : undefined,
                        };
                    } catch {
                        return {
                            title: item.title,
                            link: item.link,
                            description: item.title,
                            guid: item.link,
                        };
                    }
                })
            )
        );

        return {
            title: `Global Fleet – ${category}`,
            link: targetUrl,
            description: 'Global Fleet – International Commercial Fleet & Mobility News',
            item: items,
        };
    },
};
