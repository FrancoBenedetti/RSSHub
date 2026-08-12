import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const BASE_URL = 'https://www.transport.gov.za';

export const route: Route = {
    path: '/',
    categories: ['traditional-media'],
    example: '/transport-gov-za',
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
            source: ['transport.gov.za/'],
            target: '/',
        },
    ],
    name: 'Latest News & Media Statements',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        const posts: any[] = await ofetch(`${BASE_URL}/index.php`, {
            query: {
                rest_route: '/wp/v2/posts',
                per_page: 20,
                _embed: 1,
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

            const authorName: string = post._embedded?.author?.[0]?.name ?? 'Department of Transport';

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
            title: 'Department of Transport South Africa',
            link: BASE_URL,
            description: 'Department of Transport South Africa – Official News, Media Statements & Announcements',
            item: items,
        };
    },
};
