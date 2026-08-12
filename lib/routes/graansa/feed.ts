import { load } from 'cheerio';

import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import parser from '@/utils/rss-parser';

export const route: Route = {
    path: '/feed',
    categories: ['traditional-media'],
    example: '/graansa/feed',
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
            source: ['graansa.co.za/feed', 'graansa.co.za/'],
            target: '/feed',
        },
    ],
    name: 'Feed',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        // 1. Fetch SA Grain Magazine feed
        const magFeedUrl = 'https://sagrainmag.co.za/feed/';
        let magItems: any[] = [];
        try {
            const magFeed = await parser.parseURL(magFeedUrl);
            magItems = await Promise.all(
                magFeed.items.slice(0, 10).map((item) =>
                    cache.tryGet((item.link ?? '') + ':v1', async () => {
                        try {
                            if (item.link) {
                                const response = await ofetch(item.link, {
                                    headers: {
                                        'User-Agent': config.trueUA,
                                    },
                                });
                                const $ = load(response);
                                const content = $('.entry-content').html() || $('.wp-block-post-content').html() || item.content || item.contentSnippet;

                                return {
                                    title: `[SA Grain Mag] ${item.title ?? ''}`,
                                    link: item.link,
                                    description: content,
                                    pubDate: item.pubDate ? parseDate(item.pubDate) : undefined,
                                    author: item.creator || item.author,
                                    category: item.categories,
                                };
                            }
                        } catch {
                            // Fallback
                        }
                        return {
                            title: `[SA Grain Mag] ${item.title ?? ''}`,
                            link: item.link,
                            description: item.content || item.contentSnippet || item.title,
                            pubDate: item.pubDate ? parseDate(item.pubDate) : undefined,
                        };
                    })
                )
            );
        } catch {
            // Ignore mag failures and proceed with main site news
        }

        // 2. Fetch Grain SA website news
        const mainNewsUrl = 'https://www.grainsa.co.za/news-headlines/latest-news';
        let mainNewsItems: any[] = [];
        try {
            const response = await ofetch(mainNewsUrl, {
                headers: {
                    'User-Agent': config.trueUA,
                },
            });
            const $ = load(response);
            const rawItems = $('div.padding-bottom-10')
                .toArray()
                .slice(0, 10)
                .map((el) => {
                    const node = $(el);
                    const titleNode = node.find('h4 a');
                    const title = titleNode.text().trim();
                    const link = titleNode.attr('href');
                    const metaText = node.find('small.color-grey').text().trim();
                    const datePart = metaText.split('|', 1)[0].trim();
                    const pubDate = datePart ? parseDate(datePart, 'DD MMMM YYYY') : undefined;

                    return {
                        title: `[Grain SA] ${title}`,
                        link,
                        pubDate,
                    };
                });

            mainNewsItems = await Promise.all(
                rawItems.map((item) => {
                    if (!item.link) {
                        return item;
                    }
                    const link = item.link!;
                    return cache.tryGet(link + ':v1', async () => {
                        try {
                            const detailResponse = await ofetch(link, {
                                headers: {
                                    'User-Agent': config.trueUA,
                                },
                            });
                            const $detail = load(detailResponse);

                            // Remove share links if present
                            $detail('.share-links').remove();

                            const content = $detail('.media-body').html() || $detail('.bg-grey').html() || '';

                            return {
                                title: item.title,
                                link: item.link,
                                description: content,
                                pubDate: item.pubDate,
                            };
                        } catch {
                            return item;
                        }
                    });
                })
            );
        } catch {
            // Ignore main news failures
        }

        // 3. Combine and sort items by pubDate desc
        const allItems = [...magItems, ...mainNewsItems].toSorted((a, b) => {
            const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
            const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
            return dateB - dateA;
        });

        return {
            title: 'Grain SA / Graan SA',
            link: 'https://www.grainsa.co.za',
            description: 'Grain SA latest news and SA Grain Magazine articles',
            item: allItems,
        };
    },
};
