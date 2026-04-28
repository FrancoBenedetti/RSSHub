import { load } from 'cheerio';
import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';

export const route: Route = {
    path: '/section/:section?',
    categories: ['traditional-media'],
    example: '/dailymaverick/section/maverick-news',
    parameters: {
        section: 'Section name, e.g., maverick-news, politics, business-maverick. Default is maverick-news.',
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
            source: ['dailymaverick.co.za/section/:section'],
            target: '/section/:section',
        },
    ],
    name: 'Section News',
    maintainers: ['FrancoBenedetti'],
    handler: async (ctx) => {
        const section = ctx.req.param('section') || 'maverick-news';
        const baseUrl = 'https://www.dailymaverick.co.za';
        const url = `${baseUrl}/section/${section}/`;

        const response = await ofetch(url, {
            headers: {
                'User-Agent': config.trueUA,
            },
        });
        const $ = load(response);

        const list = $('a[href*="/article/"]')
            .toArray()
            .map((el) => {
                const link = $(el).attr('href');
                return {
                    link: link?.startsWith('http') ? link : `${baseUrl}${link}`,
                };
            })
            .filter((item, index, self) => item.link && self.findIndex((t) => t.link === item.link) === index);

        const items = await Promise.all(
            list.slice(0, 15).map((item) =>
                cache.tryGet(item.link + ':v1', async () => {
                    try {
                        const articleResponse = await ofetch(item.link, {
                            headers: {
                                'User-Agent': config.trueUA,
                            },
                        });
                        const $article = load(articleResponse);

                        const title = $article('h1').first().text().trim();
                        const content = $article('article.article-container div.article-contents div.max-w-none').first();
                        
                        // Clean up
                        content.find('.ad-container, .related-articles, .newsletter-signup, astro-island').remove();

                        return {
                            title,
                            link: item.link,
                            description: content.html(),
                            author: $article('meta[name="author"]').attr('content') || $article('.author-link').text().trim(),
                        };
                    } catch (e) {
                        return item;
                    }
                })
            )
        );

        return {
            title: `Daily Maverick - ${section}`,
            link: url,
            item: items,
        };
    },
};
