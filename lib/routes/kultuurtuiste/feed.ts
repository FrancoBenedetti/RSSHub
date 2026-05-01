import { load } from 'cheerio';
import Parser from 'rss-parser';

import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';

export const route: Route = {
    path: '/news',
    categories: ['traditional-media'],
    example: '/kultuurtuiste/news',
    parameters: {},
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
            source: ['kultuurtuiste.org.za/'],
            target: '/news',
        },
    ],
    name: 'Kultuurtuiste News',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        const feedUrl = 'https://kultuurtuiste.org.za/feed/';

        const response = await ofetch(feedUrl, {
            headers: {
                'User-Agent': config.trueUA,
            },
            responseType: 'text',
        });

        const parser = new Parser();
        const feed = await parser.parseString(response);

        const items = await Promise.all(
            feed.items.slice(0, 15).map((item) =>
                cache.tryGet(item.link + ':v1', async () => {
                    if (!item.link) {
                        return {
                            title: item.title || '',
                            description: item.content || item.contentSnippet || '',
                            link: '',
                            pubDate: item.pubDate,
                            author: item.creator,
                        };
                    }

                    try {
                        const articleResponse = await ofetch(item.link, {
                            headers: {
                                'User-Agent': config.trueUA,
                            },
                        });
                        const $ = load(articleResponse);

                        // Cleanup Strategy based on KI
                        $('script, style, .social_share_list, #social_share, .jp-relatedposts, #respond, .wprt-container').remove();

                        const title = $('h1').first().text().trim() || item.title || '';
                        let description = $('.entry-content').html() || $('article').html() || item.content || item.contentSnippet || '';
                        const image = $('meta[property="og:image"]').attr('content');

                        if (image && !description.includes(image)) {
                            description = `<img src="${image}"><br>${description}`;
                        }

                        return {
                            title,
                            description,
                            link: item.link,
                            pubDate: item.pubDate,
                            author: item.creator,
                        };
                    } catch {
                        // Fallback to RSS feed description on error
                        return {
                            title: item.title || '',
                            description: item.content || item.contentSnippet || '',
                            link: item.link,
                            pubDate: item.pubDate,
                            author: item.creator,
                        };
                    }
                })
            )
        );

        return {
            title: feed.title || 'Kultuurtuiste',
            link: feed.link || 'https://kultuurtuiste.org.za/',
            description: feed.description || 'Kultuurtuiste Nuus',
            item: items.filter((item) => item !== null),
        };
    },
};
