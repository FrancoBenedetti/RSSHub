import { load } from 'cheerio';

import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/latest',
    categories: ['traditional-media'],
    example: '/eyewitnessnews/latest',
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
            source: ['ewn.co.za/'],
            target: '/latest',
        },
    ],
    name: 'Latest News',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        const baseUrl = 'https://ewn.co.za';
        const response = await ofetch(baseUrl, {
            headers: {
                'User-Agent': config.trueUA,
            },
        });
        const $ = load(response);

        const items = await Promise.all(
            $('a[href^="/202"]')
                .toArray()
                .map((el) => {
                    const element = $(el);
                    const link = element.attr('href');
                    const title = element.text().trim();

                    if (!link || !title || title.length < 10) {
                        return null;
                    }

                    return {
                        title,
                        link: `${baseUrl}${link}`,
                    };
                })
                .filter((item, index, self): item is { title: string; link: string } => 
                    item !== null && self.findIndex((t) => t?.link === item.link) === index
                )
                .slice(0, 20)
                .map((item) =>
                    cache.tryGet(item.link + ':v1', async () => {
                        const articleResponse = await ofetch(item.link, {
                            headers: {
                                'User-Agent': config.trueUA,
                            },
                        });
                        const $article = load(articleResponse);

                        $article('script, style, .ads, .social-share, footer, nav, .related-articles').remove();

                        const author = $article('meta[name="author"]').attr('content') || $article('.author').first().text().trim();
                        const pubDate = parseDate($article('meta[property="article:published_time"]').attr('content'));
                        const image = $article('meta[property="og:image"]').attr('content');

                        let description = $article('.article-body, .entry-content, article').html() || '';

                        if (image && description && !description.includes(image)) {
                            description = `<img src="${image}"><br>${description}`;
                        }

                        return {
                            title: item.title,
                            link: item.link,
                            description,
                            author,
                            pubDate,
                        };
                    })
                )
        );

        return {
            title: 'Eyewitness News - Latest',
            link: baseUrl,
            item: items.filter((item) => item !== null),
        };
    },
};
