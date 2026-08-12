import * as cheerio from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const BASE_URL = 'https://naamsa.net';

const parsePdfDate = (url: string) => {
    const matchFull = url.match(/(20\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])/);
    if (matchFull) {
        return parseDate(`${matchFull[1]}-${matchFull[2]}-${matchFull[3]}`);
    }
    const matchYearMonth = url.match(/\/uploads\/(20\d{2})\/(0[1-9]|1[0-2])\//);
    if (matchYearMonth) {
        return parseDate(`${matchYearMonth[1]}-${matchYearMonth[2]}-01`);
    }
    return;
};

export const route: Route = {
    path: '/:type?',
    categories: ['traditional-media'],
    example: '/naamsa/press-releases',
    parameters: {
        type: {
            description: 'Category/Page type',
            options: [
                { value: 'newsroom', label: 'Newsroom' },
                { value: 'press-releases', label: 'Press Releases' },
                { value: 'quarterly-reviews', label: 'Quarterly Reviews' },
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
            source: ['naamsa.net/newsroom/'],
            target: '/newsroom',
        },
        {
            source: ['naamsa.net/press-releases/'],
            target: '/press-releases',
        },
        {
            source: ['naamsa.net/quarterly-reviews/'],
            target: '/quarterly-reviews',
        },
        {
            source: ['naamsa.net/'],
            target: '/',
        },
    ],
    name: 'News & Publications',
    maintainers: ['FrancoBenedetti'],
    handler: async (ctx) => {
        const type = ctx.req.param('type') ?? 'newsroom';

        if (type === 'press-releases') {
            const items: DataItem[] = [];
            const html: string = await ofetch(`${BASE_URL}/press-releases/`);
            const $ = cheerio.load(html);

            $('a[href*=".pdf"]').each((_, el) => {
                const href = $(el).attr('href');
                if (!href) {
                    return;
                }

                const container = $(el).closest('p, .wpb_text_column, .vc_column-inner, td, div');
                const clone = container.clone();
                clone.find('script, style').remove();
                let text = clone.text().trim().replaceAll(/\s+/g, ' ');
                text = text.replace(/\s*(VIEW NOW|VIEW PRESS RELEASE|VIEW|DOWNLOAD|READ MORE)\s*$/i, '').trim();

                if (text && items.every((i) => i.link !== href)) {
                    items.push({
                        title: text,
                        link: href,
                        description: `<p><a href="${href}" target="_blank" rel="noopener noreferrer">Download Press Release (PDF)</a></p>`,
                        pubDate: parsePdfDate(href),
                        guid: href,
                        category: ['Press Releases'],
                    });
                }
            });

            return {
                title: 'naamsa - Press Releases',
                link: `${BASE_URL}/press-releases/`,
                description: 'Official press releases and statements from naamsa',
                item: items,
            };
        }

        if (type === 'quarterly-reviews') {
            const items: DataItem[] = [];
            const html: string = await ofetch(`${BASE_URL}/quarterly-reviews/`);
            const $ = cheerio.load(html);

            $('a[href*=".pdf"]').each((_, el) => {
                const href = $(el).attr('href');
                if (!href) {
                    return;
                }

                let immediateText = $(el).parent().text().trim().replaceAll(/\s+/g, ' ');
                if (!immediateText || immediateText.length < 5 || immediateText.length > 150) {
                    const pText = $(el).closest('p, .wpb_text_column').text().trim().replaceAll(/\s+/g, ' ');
                    if (pText && pText.length <= 150) {
                        immediateText = pText;
                    }
                }

                let title = immediateText.replace(/\s*(VIEW NOW|VIEW PRESS RELEASE|VIEW|DOWNLOAD|READ MORE)\s*$/i, '').trim();

                if (!title || title.length > 150 || title.includes('2026 2025 2024')) {
                    const filename =
                        href
                            .split('/')
                            .pop()
                            ?.replace(/\.pdf$/i, '')
                            .replaceAll(/[-_]+/g, ' ') ?? '';
                    title = filename;
                }

                const yearMatch = href.match(/\/uploads\/(20\d{2})\//) ?? href.match(/(20\d{2})/);
                const year = yearMatch ? yearMatch[1] : '';

                const colOrRow = $(el).closest('.vc_column-inner, .vc_row, div');
                const colText = colOrRow.text().trim().replaceAll(/\s+/g, ' ');
                const quarterMatch = colText.match(/(1st|2nd|3rd|4th|Q[1-4])\s*Quarter/i) ?? href.match(/(1st|2nd|3rd|4th|Q[1-4])[-_\s]*Quarter/i) ?? href.match(/[-_](Q[1-4])[-_]/i);
                const quarter = quarterMatch ? quarterMatch[0] : '';

                if (quarter && !title.toLowerCase().includes(quarter.toLowerCase())) {
                    title = `${quarter} ${title}`;
                }
                if (year && !title.includes(year)) {
                    title = `${year} ${title}`;
                }

                if (title && items.every((i) => i.link !== href)) {
                    items.push({
                        title,
                        link: href,
                        description: `<p><a href="${href}" target="_blank" rel="noopener noreferrer">Download Quarterly Review (PDF)</a></p>`,
                        pubDate: parsePdfDate(href),
                        guid: href,
                        category: ['Quarterly Reviews'],
                    });
                }
            });

            return {
                title: 'naamsa - Quarterly Reviews',
                link: `${BASE_URL}/quarterly-reviews/`,
                description: 'Quarterly reviews of business conditions and sales projections from naamsa',
                item: items,
            };
        }

        // Default: newsroom
        const items: DataItem[] = [];

        try {
            const posts = await ofetch<any[]>(`${BASE_URL}/wp-json/wp/v2/posts`, {
                query: {
                    per_page: 20,
                    _embed: 1,
                },
            });

            for (const post of posts) {
                let description: string = post.content?.rendered ?? post.excerpt?.rendered ?? '';
                let imageUrl: string | undefined;

                if (Array.isArray(post.featured_image_src_large) && post.featured_image_src_large[0]) {
                    imageUrl = post.featured_image_src_large[0];
                }
                if (!imageUrl) {
                    const m = post._embedded?.['wp:featuredmedia']?.[0];
                    imageUrl = m?.source_url ?? m?.media_details?.sizes?.large?.source_url;
                }

                const postTitle: string = cheerio.load(post.title?.rendered ?? '').text();

                if (imageUrl && !description.includes(imageUrl)) {
                    description = `<img src="${imageUrl}" alt="${postTitle}"><br>${description}`;
                }

                const categories: string[] = (post._embedded?.['wp:term']?.[0] ?? []).map((t: { name: string }) => t.name);
                const author: string | undefined = post._embedded?.author?.[0]?.name;

                items.push({
                    title: postTitle,
                    link: post.link,
                    description,
                    pubDate: parseDate(post.date_gmt ?? post.date),
                    author,
                    category: categories,
                    guid: post.guid?.rendered ?? post.link,
                    image: imageUrl,
                    media: imageUrl ? { content: { url: imageUrl, medium: 'image' } } : undefined,
                });
            }
        } catch {
            // Ignore API failures and fall back to scraped newsroom
        }

        try {
            const html: string = await ofetch(`${BASE_URL}/newsroom/`);
            const $ = cheerio.load(html);

            $('a[href*=".pdf"]').each((_, el) => {
                const href = $(el).attr('href');
                if (!href) {
                    return;
                }

                const container = $(el).closest('p, .wpb_text_column, .elementor-widget-container, td, tr, div');
                const clone = container.clone();
                clone.find('script, style').remove();
                let text = clone.text().trim().replaceAll(/\s+/g, ' ');
                text = text.replace(/\s*(VIEW NOW|VIEW PRESS RELEASE|VIEW|DOWNLOAD|READ MORE)\s*$/i, '').trim();

                if (text && items.every((i) => i.link !== href)) {
                    items.push({
                        title: text,
                        link: href,
                        description: `<p><a href="${href}" target="_blank" rel="noopener noreferrer">Download Media Release (PDF)</a></p>`,
                        pubDate: parsePdfDate(href),
                        guid: href,
                        category: ['Media Release'],
                    });
                }
            });
        } catch {
            // Ignore page fetch error
        }

        return {
            title: 'naamsa - Newsroom',
            link: `${BASE_URL}/newsroom/`,
            description: 'Latest news, press releases, and media updates from naamsa',
            item: items,
        };
    },
};
