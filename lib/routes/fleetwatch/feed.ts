import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const BASE_URL = 'https://fleetwatch.co.za';

export const route: Route = {
    path: '/:category?',
    categories: ['traditional-media'],
    example: '/fleetwatch/industry-news',
    parameters: {
        category: {
            description: 'Category slug (e.g. industry-news)',
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
            source: ['fleetwatch.co.za/fleetwatch-category/:category/'],
            target: '/:category',
        },
        {
            source: ['fleetwatch.co.za/'],
            target: '/',
        },
    ],
    name: 'Latest Articles',
    maintainers: ['FrancoBenedetti'],
    handler: async (ctx) => {
        const category = ctx.req.param('category');

        const query: Record<string, string | number> = {
            per_page: 20,
            _embed: 1,
        };

        const posts: any[] = await ofetch(`${BASE_URL}/wp-json/wp/v2/fleetwatch-article`, { query });

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

            const authorName: string = post._embedded?.author?.[0]?.name ?? 'Fleetwatch';

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
            title: category ? `Fleetwatch – ${category}` : 'Fleetwatch',
            link: category ? `${BASE_URL}/fleetwatch-category/${category}/` : BASE_URL,
            description: 'Fleetwatch Magazine – Transport and Commercial Vehicle Industry News',
            item: items,
        };
    },
};
