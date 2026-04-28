import { load } from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/media/:category?',
    categories: ['traditional-media'],
    example: '/lexlibertas/media',
    parameters: {
        category: {
            description: 'Category name. Leave empty for all media.',
            options: [
                { value: 'announcements', label: 'Announcements' },
                { value: 'articles', label: 'Articles' },
                { value: 'media-statements', label: 'Media Statements' },
                { value: 'open-letters', label: 'Open Letters' },
                { value: 'research-and-analysis', label: 'Research and Analysis' },
                { value: 'speeches', label: 'Speeches' },
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
            source: ['lexlibertas.org.za/media/:category?'],
            target: '/media/:category',
        },
    ],
    name: 'Media',
    maintainers: ['FrancoBenedetti'],
    handler: async (ctx) => {
        const category = ctx.req.param('category');
        const baseUrl = 'https://www.lexlibertas.org.za';
        const targetUrl = category ? `${baseUrl}/media/${category}` : `${baseUrl}/media`;

        const response = await ofetch(targetUrl);
        const $ = load(response);

        // Based on the markdown, items seem to be in blocks with titles and links
        // We'll look for links inside headers or specific containers
        const items = await Promise.all(
            $('article, .grid div, [href*="/media/"]')
                .toArray()
                .map((el) => {
                    const element = $(el);
                    const link = element.attr('href') || element.find('a').attr('href');

                    if (!link || !link.startsWith('/media/') || link === '/media') {
                        return null;
                    }

                    const title = element.find('h1, h2, h3').first().text().trim() || element.text().trim().split('\n')[0];

                    return {
                        title: title || 'Untitled',
                        link: link.startsWith('http') ? link : baseUrl + link,
                    };
                })
                .filter((item): item is { title: string; link: string } => item !== null)
                // Filter unique links
                .filter((item, index, self) => index === self.findIndex((t) => t.link === item.link))
                .slice(0, 15)
                .map((item) =>
                    cache.tryGet(item.link + ':v2', async () => {
                        try {
                            const articleResponse = await ofetch(item.link);
                            const $article = load(articleResponse);

                            const content = $article('main, article, .prose').first();

                            // Clean up
                            content.find('nav, footer, .related, script, iframe').remove();

                            const fullContent = content.html();
                            if (fullContent) {
                                item.description = fullContent;
                            }

                            // Try to find a date in the text
                            const dateMatch = $article('body')
                                .text()
                                .match(/(\d{2}\/\d{2}\/\d{4})/);
                            if (dateMatch) {
                                item.pubDate = parseDate(dateMatch[1], 'DD/MM/YYYY');
                            }

                            // Image
                            const ogImage = $article('meta[property="og:image"]').attr('content');
                            if (ogImage && item.description && !item.description.includes(ogImage)) {
                                item.description = `<img src="${ogImage}"><br>${item.description}`;
                            }
                        } catch {
                            // Fallback
                        }
                        return item;
                    })
                )
        );

        return {
            title: `Lex Libertas - ${category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Media'}`,
            link: targetUrl,
            item: items,
        };
    },
};
