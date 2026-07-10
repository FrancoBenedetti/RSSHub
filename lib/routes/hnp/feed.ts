import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/',
    categories: ['traditional-media'],
    example: '/hnp',
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
            source: ['www.hnp.org.za/'],
            target: '/',
        },
    ],
    name: 'Latest Posts',
    maintainers: ['FrancoBenedetti'],
    handler: async () => {
        const baseUrl = 'https://www.hnp.org.za';

        const posts = await ofetch(`${baseUrl}/wp-json/wp/v2/posts`, {
            query: {
                per_page: 20,
                _embed: 1,
                orderby: 'date',
                order: 'desc',
            },
        });

        const items = posts.map((post: any) => {
            let description: string = post.content?.rendered ?? '';
            let imageUrl: string | undefined;

            // Extract featured image from the embedded media data
            if (Array.isArray(post.featured_image_src_large) && post.featured_image_src_large[0]) {
                imageUrl = post.featured_image_src_large[0];
            }

            if (!imageUrl) {
                const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
                imageUrl = featuredMedia?.source_url ?? featuredMedia?.media_details?.sizes?.large?.source_url;
            }

            if (imageUrl && !description.includes(imageUrl)) {
                description = `<img src="${imageUrl}" alt="${post.title?.rendered ?? ''}">\n${description}`;
            }

            const categoryNames: string[] = post._embedded?.['wp:term']?.[0]?.map((c: any) => c.name) || [];
            const authorName: string = post._embedded?.author?.[0]?.name || 'HNP';

            return {
                title: post.title?.rendered ?? '',
                link: post.link,
                description,
                pubDate: parseDate(post.date_gmt ?? post.date),
                author: authorName,
                category: categoryNames,
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
            title: 'Herstigte Nasionale Party',
            link: baseUrl,
            description: 'Herstigte Nasionale Party (HNP) – Amptelike nuus en publikasies',
            item: items,
        };
    },
};
