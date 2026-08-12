import { config } from '@/config';
import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import parser from '@/utils/rss-parser';

const BASE_URL = 'https://topauto.co.za';

export const route: Route = {
    path: '/:category?',
    categories: ['traditional-media'],
    example: '/topauto/new-models',
    parameters: {
        category: {
            description: 'Category slug (e.g. news, new-models, industry-news, car-finance, features)',
            options: [
                { value: 'news', label: 'News' },
                { value: 'new-models', label: 'New Models' },
                { value: 'industry-news', label: 'Industry News' },
                { value: 'car-finance', label: 'Car Finance' },
                { value: 'features', label: 'Features' },
            ],
        },
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['topauto.co.za/:category/'],
            target: '/:category',
        },
        {
            source: ['topauto.co.za/'],
            target: '/',
        },
    ],
    name: 'Latest Automotive News & Articles',
    maintainers: ['FrancoBenedetti'],
    handler: async (ctx) => {
        const category = ctx.req.param('category');

        try {
            let categoryId: number | undefined;
            if (category) {
                const cats: Array<{ id: number; slug: string }> = await ofetch(`${BASE_URL}/wp-json/wp/v2/categories`, {
                    query: { slug: category, per_page: 1 },
                    headers: {
                        'User-Agent': config.trueUA,
                        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    },
                });
                categoryId = cats[0]?.id;
            }

            const query: Record<string, string | number> = {
                per_page: 20,
                _embed: 1,
                orderby: 'date',
                order: 'desc',
            };
            if (categoryId) {
                query.categories = categoryId;
            }

            const posts: any[] = await ofetch(`${BASE_URL}/wp-json/wp/v2/posts`, {
                query,
                headers: {
                    'User-Agent': config.trueUA,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
            });

            const items = posts.map((post) => {
                let description: string = post.content?.rendered ?? post.excerpt?.rendered ?? '';

                let imageUrl: string | undefined;
                if (Array.isArray(post.featured_image_src_large) && post.featured_image_src_large[0]) {
                    imageUrl = post.featured_image_src_large[0];
                }
                if (!imageUrl) {
                    const m = post._embedded?.['wp:featuredmedia']?.[0];
                    imageUrl = m?.source_url ?? m?.media_details?.sizes?.large?.source_url;
                }

                if (imageUrl && !description.includes(imageUrl)) {
                    description = `<img src="${imageUrl}" alt="${post.title?.rendered ?? ''}">\n${description}`;
                }

                const authorName: string = post._embedded?.author?.[0]?.name ?? 'TopAuto';

                return {
                    title: post.title?.rendered ?? '',
                    link: post.link,
                    description,
                    pubDate: parseDate(post.date_gmt ?? post.date),
                    author: authorName,
                    guid: post.guid?.rendered ?? post.link,
                    image: imageUrl,
                    media: imageUrl
                        ? {
                              content: {
                                  url: imageUrl,
                                  medium: 'image',
                              },
                          }
                        : undefined,
                };
            });

            return {
                title: category ? `TopAuto – ${category}` : 'TopAuto',
                link: category ? `${BASE_URL}/${category}/` : BASE_URL,
                description: 'TopAuto – South African Automotive News, New Models, Car Reviews & Industry Trends',
                item: items,
            };
        } catch {
            // Fallback for datacenter IP blocking (Cloudflare WAF on Vercel)
            const searchQuery = category ? `site:topauto.co.za/${category}` : 'site:topauto.co.za';
            const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=en-ZA&gl=ZA&ceid=ZA:en`;
            const feed = await parser.parseURL(feedUrl);

            return {
                title: category ? `TopAuto – ${category}` : 'TopAuto',
                link: category ? `${BASE_URL}/${category}/` : BASE_URL,
                description: 'TopAuto – South African Automotive News, New Models, Car Reviews & Industry Trends',
                item: feed.items.map((item) => ({
                    title: item.title ?? '',
                    link: item.link,
                    pubDate: item.pubDate ? parseDate(item.pubDate) : undefined,
                    author: item.creator ?? 'TopAuto',
                    category: item.categories,
                    description: item['content:encoded'] || item.content || item.description || item.contentSnippet,
                })),
            };
        }
    },
};
