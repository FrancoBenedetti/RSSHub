import { load } from 'cheerio';

import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/artikels',
    categories: ['traditional-media'],
    example: '/vryheidstigting/artikels',
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
            source: ['vryheidstigting.org/artikels'],
            target: '/artikels',
        },
    ],
    name: 'Artikels',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        const baseUrl = 'https://vryheidstigting.org';
        const response = await ofetch(`${baseUrl}/artikels`, {
            headers: {
                'User-Agent': config.trueUA,
            },
        });
        const $ = load(response);

        // Extracting articles from the page
        const list = $('a[href^="/"]')
            .filter((_, el) => {
                const href = $(el).attr('href') || '';
                return href !== '/' && !href.includes('perspektief') && !href.includes('kyk') && !href.includes('luister') && !href.includes('uitgewery') && !href.includes('betrokke') && !href.includes('tuis');
            })
            .toArray()
            .map((el) => {
                const href = $(el).attr('href') || '';
                return {
                    link: `${baseUrl}${href}`,
                    title: $(el).text().trim() || href.replace('/', '').replace(/-/g, ' '),
                };
            })
            .filter((item) => item.title && item.link);

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

                        const plasing = $article('.plasing');
                        const content = plasing.find('.plasingheader').nextAll().html() || plasing.html() || $article('main').html();
                        const title = plasing.find('h1').first().text().trim() || item.title;

                        return {
                            title,
                            link: item.link,
                            description: content,
                        };
                    } catch (e) {
                        return item;
                    }
                })
            )
        );

        return {
            title: 'Vryheidstigting - Artikels',
            link: `${baseUrl}/artikels`,
            item: items,
        };
    },
};
