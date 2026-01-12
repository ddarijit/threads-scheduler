const THREADS_API_BASE = 'https://graph.threads.net/v1.0';

export interface ThreadsError {
    error: {
        message: string;
        type: string;
        code: number;
        fbtrace_id: string;
    };
}

export const threadsApi = {
    // Helper for Safe JSON Parsing (BigInt protection)
    // Threads API can return 64-bit integers for IDs which JS numbers can't hold precisely.
    parseSafeJson: async (response: Response) => {
        const text = await response.text();
        try {
            // Regex to wrap large integers (like "user_id": 123456789012345678) in quotes
            const safeText = text.replace(/"(id|user_id|media_id)":\s*(\d+)/g, '"$1": "$2"');
            return JSON.parse(safeText);
        } catch (e) {
            console.error('[ThreadsAPI] JSON Parse Error:', e);
            console.error('[ThreadsAPI] Raw Response:', text);
            throw new Error('Failed to parse Threads API response');
        }
    },

    // 0. Verify Connection
    getUserProfile: async (token: string) => {
        const response = await fetch(`${THREADS_API_BASE}/me?fields=id,username&access_token=${token}`);
        const data = await threadsApi.parseSafeJson(response);
        if (data.error) throw data.error;
        return data; // { id, username }
    },

    // 1. Create a Thread Container (Text, Image, or Video)
    createContainer: async (token: string, userId: string, text: string, mediaType: 'TEXT' | 'IMAGE' | 'VIDEO' = 'TEXT', mediaUrl?: string, replyToId?: string) => {
        const params = new URLSearchParams({
            media_type: mediaType,
            text: text,
            access_token: token,
        });

        if (mediaType === 'IMAGE' && mediaUrl) {
            params.append('image_url', mediaUrl);
        } else if (mediaType === 'VIDEO' && mediaUrl) {
            params.append('video_url', mediaUrl);
        }

        if (replyToId) {
            params.append('reply_to_id', replyToId);
        }

        console.log(`[createContainer] Creating ${mediaType} container. URL: ${mediaUrl || 'N/A'} ReplyTo: ${replyToId || 'N/A'}`);
        const response = await fetch(`${THREADS_API_BASE}/${userId}/threads?${params.toString()}`, {
            method: 'POST',
        });

        const data = await threadsApi.parseSafeJson(response);
        console.log('[createContainer] Response:', data);

        if (data.error) {
            console.error('[createContainer] Error:', JSON.stringify(data.error, null, 2));
            throw data.error;
        }
        return data.id; // creation_id
    },

    // 2. Publish the Container
    publishContainer: async (token: string, userId: string, creationId: string) => {
        const params = new URLSearchParams({
            creation_id: creationId,
            access_token: token,
        });

        console.log(`[publishContainer] Publishing creationId: ${creationId}`);
        const response = await fetch(`${THREADS_API_BASE}/${userId}/threads_publish?${params.toString()}`, {
            method: 'POST',
        });

        const data = await threadsApi.parseSafeJson(response);
        if (data.error) {
            console.error('[publishContainer] Error:', JSON.stringify(data.error, null, 2));
            throw data.error;
        }
        return data.id; // published thread id
    },

    // 3. Create Carousel Item
    createCarouselItem: async (token: string, userId: string, mediaType: 'IMAGE' | 'VIDEO', mediaUrl: string) => {
        const params = new URLSearchParams({
            media_type: mediaType,
            is_carousel_item: 'true',
            access_token: token,
        });

        if (mediaType === 'IMAGE') params.append('image_url', mediaUrl);
        if (mediaType === 'VIDEO') params.append('video_url', mediaUrl);

        console.log(`[CarouselItem] Creating ${mediaType} item for ${mediaUrl}`);
        const response = await fetch(`${THREADS_API_BASE}/${userId}/threads?${params.toString()}`, {
            method: 'POST',
        });

        const data = await threadsApi.parseSafeJson(response);
        console.log('[CarouselItem] Response:', data);

        if (data.error) {
            console.error('[CarouselItem] Error:', JSON.stringify(data.error, null, 2));
            throw data.error;
        }
        return data.id;
    },

    // 4. Create Carousel Container
    createCarouselContainer: async (token: string, userId: string, text: string, childrenIds: string[], replyToId?: string) => {
        const params = new URLSearchParams({
            media_type: 'CAROUSEL',
            text: text,
            children: childrenIds.join(','),
            access_token: token,
        });

        if (replyToId) {
            params.append('reply_to_id', replyToId);
        }

        console.log(`[CarouselContainer] Creating container with children: ${childrenIds.join(',')} ReplyTo: ${replyToId || 'N/A'}`);
        const response = await fetch(`${THREADS_API_BASE}/${userId}/threads?${params.toString()}`, {
            method: 'POST',
        });

        const data = await threadsApi.parseSafeJson(response);
        console.log('[CarouselContainer] Response:', data);

        if (data.error) {
            console.error('[CarouselContainer] Error:', JSON.stringify(data.error, null, 2));
            throw data.error;
        }
        return data.id;
    },

    // 5. Check Container Status
    getContainerStatus: async (token: string, creationId: string) => {
        const response = await fetch(`${THREADS_API_BASE}/${creationId}?fields=status,error_message&access_token=${token}`);
        const data = await threadsApi.parseSafeJson(response);
        return data; // { status: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED", error_message?: string }
    },

    // 6. Wait for Container to be Ready (Polling)
    waitForContainer: async (token: string, creationId: string, maxRetries = 10, delayMs = 3000) => {
        console.log(`[waitForContainer] Waiting for ${creationId} to process...`);
        for (let i = 0; i < maxRetries; i++) {
            const data = await threadsApi.getContainerStatus(token, creationId);
            console.log(`[waitForContainer] Status (${i + 1}/${maxRetries}): ${data.status}`);

            if (data.status === 'FINISHED') return true;
            if (data.status === 'ERROR' || data.status === 'EXPIRED') {
                throw new Error(`Container processing failed: ${data.status} - ${data.error_message || 'Unknown error'}`);
            }

            // Wait before next check
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        throw new Error('Container processing timed out');
    },

    // 7. Reply to Thread
    replyToThread: async (token: string, userId: string, parentThreadId: string, text: string) => {
        console.log(`[replyToThread] Replying to ${parentThreadId} with text: "${text.substring(0, 20)}..."`);
        // Replies are just text containers with a reply_to_id
        const creationId = await threadsApi.createContainer(token, userId, text, 'TEXT', undefined, parentThreadId);

        await threadsApi.waitForContainer(token, creationId);
        const replyId = await threadsApi.publishContainer(token, userId, creationId);
        return replyId;
    },

    // Helper to do both (Single or Carousel)
    postThread: async (token: string, userId: string, text: string, mediaType: 'TEXT' | 'IMAGE' | 'VIDEO' = 'TEXT', mediaUrls?: string[]) => {
        try {
            let creationId;

            // CASE 1: Carousel (Multiple Media)
            if (mediaUrls && mediaUrls.length > 1) {
                console.log('Step 1: Creating Carousel Items...');
                const childrenIds = [];
                for (const url of mediaUrls) {
                    // Detect type for each item
                    const isVideo = url.match(/\.(mp4|mov|avi|webm)($|\?)/i);
                    const type = isVideo ? 'VIDEO' : 'IMAGE';
                    const id = await threadsApi.createCarouselItem(token, userId, type, url);

                    // CRITICAL: If item is VIDEO, we MUST wait for it to be ready before attaching to carousel
                    if (type === 'VIDEO') {
                        await threadsApi.waitForContainer(token, id, 15, 2000); // 30s timeout for items
                    }

                    childrenIds.push(id);
                }

                console.log('Step 2: Creating Carousel Container...');
                creationId = await threadsApi.createCarouselContainer(token, userId, text, childrenIds);
            }
            // CASE 2: Single Media
            else if (mediaUrls && mediaUrls.length === 1) {
                console.log('Step 1: Creating Single Media Container...');
                const url = mediaUrls[0];
                let type: 'IMAGE' | 'VIDEO' | 'TEXT' = mediaType;

                // FORCE DETECT TYPE if it was passed as generic 'TEXT' or just to be safe
                const isVideo = url.match(/\.(mp4|mov|avi|webm)($|\?)/i);
                type = isVideo ? 'VIDEO' : 'IMAGE';

                creationId = await threadsApi.createContainer(token, userId, text, type, url);
            }
            // CASE 3: Text Only
            else {
                console.log('Step 1: Creating Text Container...');
                creationId = await threadsApi.createContainer(token, userId, text);
            }

            // WAITING PHASE: All containers (Single Video, Carousel, maybe even Image) *might* need processing.
            // Text is instant. Image is usually instant. Video/Carousel takes time.
            // Safest to ALWAY wait for FINISHED status unless it's pure text.
            console.log('Step 2.5: Waiting for Container Readiness...', creationId);
            await threadsApi.waitForContainer(token, creationId);

            console.log('Step 3: Publishing Container...', creationId);
            const threadId = await threadsApi.publishContainer(token, userId, creationId);

            return threadId;
        } catch (error: any) {
            console.error('Threads API Error:', error);
            throw new Error(error.message || 'Failed to publish thread');
        }
    }
};
