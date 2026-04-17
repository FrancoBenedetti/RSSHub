import { load } from 'cheerio';

import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import parser from '@/utils/rss-parser';

export const route: Route = {
    path: '/:category?',
    categories: ['traditional-media'],
    example: '/kragdag/veiligheid',
    parameters: {
        category: {
            description: 'Category name. Leave empty for the main feed.',
            options: [
                { value: 'veiligheid', label: 'Veiligheid' },
                { value: 'gesondheid', label: 'Gesondheid' },
                { value: 'energieselfvoorsiening', label: 'Energie' },
                { value: 'voedselteenstand', label: 'Voedsel' },
                { value: 'water', label: 'Water' },
            ],
        },
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
            source: ['kragdag-gemeenskap.co.za/category/:category/'],
            target: '/:category',
        },
        {
            source: ['kragdag-gemeenskap.co.za/'],
            target: '/',
        },
    ],
    name: 'Webjoernaal / Category Feed',
    maintainers: ['FrancoBenedetti'],
    handler: async (ctx) => {
        const category = ctx.req.param('category');
        const feedUrl = category ? `https://kragdag-gemeenskap.co.za/category/${category}/feed/` : 'https://kragdag-gemeenskap.co.za/feed/';

        const feed = await parser.parseURL(feedUrl);

        const items = await Promise.all(
            feed.items.slice(0, 15).map((item) =>
                cache.tryGet(item.link + ':v3', async () => {
                    try {
                        const response = await ofetch(item.link, {
                            headers: {
                                'User-Agent': config.trueUA,
                            },
                        });
                        const $ = load(response);

                        let content = $('#post_body').first();

                        if (!content.length) {
                            content = $('.post_content').first();
                        }

                        // Clean up
                        content
                            .find(
                                '.sharedaddy, .wpcnt, .jp-relatedposts, script, iframe, .ad-banner, .post_thumbnail, .post-ratings, .social_share_list, #social_share, .post_title, .post_dates, .post_author, .breadcrumb, nav.post_item, figure.post_thum, #about_author, .nav_link_box'
                            )
                            .remove();

                        const fullContent = content.html();
                        if (fullContent) {
                            item.description = fullContent;
                        }

                        // Image extraction
                        const ogImage = $('meta[property="og:image"]').attr('content');
                        if (ogImage && item.description && !item.description.includes(ogImage)) {
                            item.description = `<img src="${ogImage}"><br>${item.description}`;
                        }
                    } catch {
                        // Fallback to what we have in the feed
                    }
                    return {
                        title: item.title,
                        link: item.link,
                        guid: item.link,
                        description: item.description,
                        pubDate: item.pubDate,
                        author: item.author || (item as any).creator,
                        category: item.categories,
                    };
                })
            )
        );

        return {
            title: `${feed.title} | KragDag Gemeenskap`,
            link: category ? `https://kragdag-gemeenskap.co.za/category/${category}/` : 'https://kragdag-gemeenskap.co.za/',
            description: feed.description,
            item: items,
        };
    },
};
