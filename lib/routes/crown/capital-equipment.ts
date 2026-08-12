import * as cheerio from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const BASE_URL = 'https://www.crown.co.za';

export const route: Route = {
    path: '/capital-equipment-news',
    categories: ['traditional-media'],
    example: '/crown/capital-equipment-news',
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
            source: ['crown.co.za/capital-equipment-news'],
            target: '/capital-equipment-news',
        },
    ],
    name: 'Capital Equipment News',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        const url = `${BASE_URL}/capital-equipment-news`;
        const html = await ofetch(url);
        const $ = cheerio.load(html);

        const list = $('a[href*="/capital-equipment-news/"]')
            .toArray()
            .map((el) => {
                const $a = $(el);
                const href = $a.attr('href') || '';
                const title = $a.text().trim();
                const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
                return { title, link: fullUrl };
            })
            .filter((item) => item.title && item.title.length > 10 && !item.link.endsWith('/capital-equipment-news') && !item.title.startsWith('View more'));

        const uniqueItems = [...new Map(list.map((item) => [item.link, item])).values()].slice(0, 20);

        const items = await Promise.all(
            uniqueItems.map((item) =>
                cache.tryGet(item.link + ':v2', async () => {
                    try {
                        const articleHtml = await ofetch(item.link);
                        const $article = cheerio.load(articleHtml);

                        const title = $article('h1, h2.item-title, .item-page h2').first().text().trim() || item.title;
                        const $content = $article('.item-page, article, .item-container').first();

                        $content.find('script, style, .social-buttons, .back-button, .btn-group, .icons, dd.create, dd.modified, dd.hits, .published, ul.actions').remove();

                        const imgUrl = $content.find('img').first().attr('src');
                        const fullImgUrl = imgUrl ? (imgUrl.startsWith('http') ? imgUrl : `${BASE_URL}${imgUrl}`) : undefined;

                        let description = $content.html() || '';
                        if (fullImgUrl && !description.includes(fullImgUrl)) {
                            description = `<img src="${fullImgUrl}" alt="${title}">\n${description}`;
                        }

                        const dateStr = $article('time, .createdate, .published, dd.create').first().text().trim();
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
            title: 'Crown Publications – Capital Equipment News',
            link: url,
            description: 'Capital Equipment News – Engineering, construction and mining equipment news across Southern Africa',
            item: items,
        };
    },
};
