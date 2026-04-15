import { load } from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/news/:category?',
    categories: ['technology'],
    example: '/mybroadband/news',
    parameters: {
        category: 'Category name, can be found in the URL. Default is all news.',
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
            source: ['mybroadband.co.za/news/'],
            target: '/news',
        },
        {
            source: ['mybroadband.co.za/news/category/:category'],
            target: '/news/:category',
        },
    ],
    name: 'News',
    maintainers: ['FrancoBenedetti'],
    handler: async (ctx) => {
        const category = ctx.req.param('category');
        const baseUrl = 'https://mybroadband.co.za/news/';
        const targetUrl = category ? `${baseUrl}category/${category}` : baseUrl;

        const response = await ofetch(targetUrl);
        const $ = load(response);

        // Grid items usually have h3 and a links
        const items = await Promise.all(
            $('.grid-view__item, article, .post-container')
                .toArray()
                .map((el) => {
                    const element = $(el);
                    const link = element.find('h1 a, h2 a, h3 a, .post-item__title a').first().attr('href');
                    const title = element.find('h1, h2, h3, .post-item__title').first().text().trim();

                    if (!link) {
                        return null;
                    }

                    return {
                        title,
                        link,
                    };
                })
                .filter((item): item is { title: string; link: string } => item !== null)
                .slice(0, 15)
                .map((item) =>
                    cache.tryGet(item.link, async () => {
                        const articleResponse = await ofetch(item.link);
                        const $article = load(articleResponse);

                        // Remove ads and unnecessary elements
                        $article('script, style, .adsbygoogle, .post-item__social, .post-item__author-bio, video').remove();

                        const title = $article('h1').text().trim();
                        const author = $article('.post-item__author').first().text().trim();
                        const pubDate = parseDate($article('meta[property="article:published_time"]').attr('content'));
                        const image = $article('meta[property="og:image"]').attr('content');

                        let description = $article('.post-item__content').html() || $article('article').html() || '';

                        if (image) {
                            description = `<img src="${image}"><br>${description}`;
                        }

                        return {
                            title,
                            link: item.link,
                            description,
                            author,
                            pubDate,
                        };
                    })
                )
        );

        return {
            title: `MyBroadband - ${category ? category.charAt(0).toUpperCase() + category.slice(1) : 'News'}`,
            link: targetUrl,
            item: items.filter((item) => item !== null),
        };
    },
};
