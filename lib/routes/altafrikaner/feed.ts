import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/',
    categories: ['traditional-media'],
    example: '/altafrikaner',
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
            source: ['altafrikaner.com/'],
            target: '/',
        },
    ],
    name: 'Latest Posts',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        const baseUrl = 'https://altafrikaner.substack.com';
        const posts = await ofetch(`${baseUrl}/api/v1/posts`, {
            query: {
                limit: 20,
            },
        });

        const items = posts.map((post: any) => {
            let description = post.body_html || post.description || '';
            const imageUrl = post.cover_image;

            if (imageUrl && !description.includes(imageUrl)) {
                description = `<img src="${imageUrl}" alt="${post.title || ''}">\n${description}`;
            }

            const authorName = post.publishedBylines?.map((b: any) => b.name).join(', ') || 'AltAfrikaner';
            const categories = post.postTags?.map((t: any) => t.name) || [];

            return {
                title: post.title || '',
                link: post.canonical_url,
                description,
                pubDate: parseDate(post.post_date),
                author: authorName,
                category: categories,
                guid: post.canonical_url,
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
            title: 'AltAfrikaner',
            link: 'https://altafrikaner.com',
            description: 'AltAfrikaner – Onafhanklike ondersoekende joernalistiek en nuus',
            item: items,
        };
    },
};
