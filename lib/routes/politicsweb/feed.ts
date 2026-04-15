import { load } from 'cheerio';
import Parser from 'rss-parser';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/:section?',
    categories: ['politics'],
    example: '/politicsweb',
    parameters: {
        section: 'Section name, e.g., news-and-analysis, comment, politics, archive. Default is daily news feed.',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: 'Feed',
    maintainers: ['FrancoBenedetti'],
    handler: async (ctx) => {
        const section = ctx.req.param('section') || 'daily_news';
        const parser = new Parser();

        // Map common sections to their RSS feeds if possible, or use the default one
        // Browsing the site suggests they have a specific XML structure
        const feedUrl = `https://www.politicsweb.co.za/politicsweb/rss/politicsweb/en/politicsweb_${section.replaceAll(/-/g, '_')}.xml`;

        let feed;
        try {
            feed = await parser.parseURL(feedUrl);
        } catch {
            // Fallback to daily news if the specific section feed doesn't exist
            feed = await parser.parseURL('https://www.politicsweb.co.za/politicsweb/rss/politicsweb/en/politicsweb_daily_news.xml');
        }

        const items = await Promise.all(
            feed.items.slice(0, 15).map((item) =>
                cache.tryGet(item.link!, async () => {
                    try {
                        const response = await ofetch(item.link!);
                        const $ = load(response);

                        // The content is usually in .entry-content or similar
                        const content = $('.entry-content, .article-content').first();

                        // Cleanup
                        content.find('script, style, .adsbygoogle, .social-share').remove();

                        return {
                            title: item.title,
                            link: item.link,
                            description: content.html() || item.content || item.summary,
                            pubDate: parseDate(item.pubDate),
                            author: item.creator || item.author,
                        };
                    } catch {
                        return {
                            title: item.title,
                            link: item.link,
                            description: item.content || item.summary,
                            pubDate: parseDate(item.pubDate),
                            author: item.creator || item.author,
                        };
                    }
                })
            )
        );

        return {
            title: feed.title || `Politicsweb - ${section}`,
            link: feed.link || 'https://www.politicsweb.co.za/',
            item: items.filter((item) => item !== null),
        };
    },
};
