import { load } from 'cheerio';

import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import parser from '@/utils/rss-parser';

export const route: Route = {
    path: '/leesstof',
    categories: ['traditional-media'],
    example: '/solidariteit/leesstof',
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
            source: ['solidariteit.co.za/leesstof'],
            target: '/leesstof',
        },
    ],
    name: 'Leesstof',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        const feedUrl = 'https://cms.solidariteit.co.za/feed/';
        const feed = await parser.parseURL(feedUrl);

        const items = await Promise.all(
            feed.items.slice(0, 20).map((item) =>
                cache.tryGet(item.link + ':v2', async () => {
                    try {
                        const response = await ofetch(item.link, {
                            headers: {
                                'User-Agent': config.trueUA,
                            },
                        });
                        const $ = load(response);

                        // Solidariteit Aanlyn uses Livewire and stores content in a JSON snapshot
                        const snapshotData = $('div[wire\\:snapshot]').first().attr('wire:snapshot');
                        if (snapshotData) {
                            try {
                                const snapshot = JSON.parse(snapshotData);
                                const article = snapshot.data.wpArticle?.[0];
                                if (article && article.content) {
                                    return {
                                        title: article.title || item.title,
                                        link: item.link,
                                        description: article.content,
                                        pubDate: item.pubDate,
                                        author: article.author || item.author,
                                        category: article.category,
                                    };
                                }
                            } catch (e) {
                                // Fallback to meta tags
                            }
                        }

                        // Fallback: Try to get description from meta tags or simple extraction
                        const description = $('meta[property="og:description"]').attr('content') || item.contentSnippet;
                        const image = $('meta[property="og:image"]').attr('content');

                        return {
                            title: item.title,
                            link: item.link,
                            description: image ? `<img src="${image}"><br>${description}` : description,
                            pubDate: item.pubDate,
                            author: item.author,
                        };
                    } catch (e) {
                        return {
                            title: item.title,
                            link: item.link,
                            description: item.contentSnippet || item.title,
                            pubDate: item.pubDate,
                        };
                    }
                })
            )
        );

        return {
            title: 'Solidariteit - Leesstof',
            link: 'https://solidariteit.co.za/leesstof',
            item: items,
        };
    },
};
