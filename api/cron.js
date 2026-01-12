import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client (Service Role)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    // 0. Security Header Check (Optional but recommended so only Vercel Cron calls this)
    // Vercel Cron requests always have this header.
    // We can also check for a custom secret if configured.
    const authHeader = req.headers['authorization'];
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!supabaseServiceKey) {
        console.error('[Cron] Skipped: Missing Service Role Key');
        return res.status(500).json({ error: 'Server misconfiguration: Missing SUPABASE_SERVICE_ROLE_KEY' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        console.log('[Cron] Running scheduled checks...');
        const now = new Date().toISOString();

        // 1. Fetch Due Threads
        const { data: dueThreads, error } = await supabase
            .from('threads')
            .select('*')
            .eq('status', 'scheduled')
            .lte('scheduled_time', now);

        if (error) {
            console.error('[Cron] Error fetching threads:', error);
            return res.status(500).json({ error: error.message });
        }

        if (!dueThreads?.length) {
            console.log('[Cron] No due threads.');
            return res.status(200).json({ message: 'No due threads' });
        }

        console.log(`[Cron] Found ${dueThreads.length} due threads. Processing...`);

        const results = [];

        // 2. Process Each Thread
        for (const thread of dueThreads) {
            // LOCKING MECHANISM: Atomic Update
            const { data: lockedThread, error: lockError } = await supabase
                .from('threads')
                .update({ status: 'publishing' })
                .eq('id', thread.id)
                .eq('status', 'scheduled')
                .select()
                .single();

            if (lockError || !lockedThread) {
                console.log(`[Cron] Could not lock thread ${thread.id}, skipping.`);
                results.push({ id: thread.id, status: 'skipped_lock' });
                continue;
            }

            try {
                // 3. Get User Tokens
                const { data: tokenData, error: tokenError } = await supabase
                    .from('user_tokens')
                    .select('threads_access_token, threads_user_id')
                    .eq('user_id', thread.user_id)
                    .single();

                if (tokenError || !tokenData) {
                    throw new Error('User tokens not found for thread owner');
                }

                // 4. Publish to Threads
                console.log(`[Cron] Publishing thread ${thread.id} for user ${thread.user_id}`);

                const accessToken = tokenData.threads_access_token;
                const userId = tokenData.threads_user_id;
                let creationId = null;

                // --- HELPER: POST Request ---
                const postToThreads = async (endpoint, params) => {
                    const url = `https://graph.threads.net/v1.0/${userId}/${endpoint}`;
                    const response = await fetch(url, {
                        method: 'POST',
                        body: params
                    });
                    const data = await response.json();
                    if (data.error) throw new Error(data.error.message);
                    return data;
                };

                // --- HELPER: Check Status ---
                const getContainerStatus = async (containerId) => {
                    const url = `https://graph.threads.net/v1.0/${containerId}?fields=status,error_message&access_token=${accessToken}`;
                    const response = await fetch(url);
                    const data = await response.json();
                    if (data.error) throw new Error(data.error.message);
                    return data;
                };

                const waitForMedia = async (containerId) => {
                    let attempts = 0;
                    while (attempts < 10) { // Poll for up to 50 seconds
                        const statusData = await getContainerStatus(containerId);
                        // console.log(`[Cron] Container ${containerId} status: ${statusData.status}`);

                        if (statusData.status === 'FINISHED') return true;
                        if (statusData.status === 'ERROR') {
                            throw new Error(`Media processing failed: ${statusData.error_message}`);
                        }

                        await new Promise(r => setTimeout(r, 5000));
                        attempts++;
                    }
                    throw new Error('Media processing timed out');
                };

                // --- A. Determine Post Type ---
                const mediaUrls = thread.media_urls || [];

                if (mediaUrls.length === 0) {
                    // TEXT POST
                    const params = new URLSearchParams();
                    params.append('media_type', 'TEXT');
                    params.append('text', thread.content);
                    params.append('access_token', accessToken);

                    const result = await postToThreads('threads', params);
                    creationId = result.id;

                } else if (mediaUrls.length === 1) {
                    // SINGLE MEDIA
                    const url = mediaUrls[0];
                    const isVideo = url.match(/\.(mp4|mov|avi|webm)($|\?)/i);
                    const params = new URLSearchParams();

                    params.append('media_type', isVideo ? 'VIDEO' : 'IMAGE');
                    params.append(isVideo ? 'video_url' : 'image_url', url);
                    params.append('text', thread.content);
                    params.append('access_token', accessToken);

                    const result = await postToThreads('threads', params);
                    creationId = result.id;
                    await waitForMedia(creationId);

                } else {
                    // CAROUSEL
                    const childrenIds = [];
                    for (const url of mediaUrls) {
                        const isVideo = url.match(/\.(mp4|mov|avi|webm)($|\?)/i);
                        const itemParams = new URLSearchParams();
                        itemParams.append('media_type', isVideo ? 'VIDEO' : 'IMAGE');
                        itemParams.append(isVideo ? 'video_url' : 'image_url', url);
                        itemParams.append('is_carousel_item', 'true');
                        itemParams.append('access_token', accessToken);

                        const itemResult = await postToThreads('threads', itemParams);
                        childrenIds.push(itemResult.id);

                        if (isVideo) {
                            await waitForMedia(itemResult.id);
                        }
                    }

                    const carouselParams = new URLSearchParams();
                    carouselParams.append('media_type', 'CAROUSEL');
                    carouselParams.append('text', thread.content);
                    carouselParams.append('children', childrenIds.join(','));
                    carouselParams.append('access_token', accessToken);

                    const result = await postToThreads('threads', carouselParams);
                    creationId = result.id;
                    await waitForMedia(creationId);
                }

                if (!creationId) throw new Error('Failed to create container ID');

                // --- B. Publish Container ---
                const publishParams = new URLSearchParams();
                publishParams.append('creation_id', creationId);
                publishParams.append('access_token', accessToken);

                const publishResult = await postToThreads('threads_publish', publishParams);
                const publishedId = publishResult.id;

                // --- C. Post First Comment ---
                if (thread.first_comment && publishedId) {
                    try {
                        const commentParams = new URLSearchParams();
                        commentParams.append('media_type', 'TEXT');
                        commentParams.append('text', thread.first_comment);
                        commentParams.append('reply_to_id', publishedId);
                        commentParams.append('access_token', accessToken);

                        const commentResult = await postToThreads('threads', commentParams);
                        const commentCreationId = commentResult.id;

                        const commentPublishParams = new URLSearchParams();
                        commentPublishParams.append('creation_id', commentCreationId);
                        commentPublishParams.append('access_token', accessToken);

                        await postToThreads('threads_publish', commentPublishParams);
                    } catch (commentErr) {
                        console.error('[Cron] Failed to publish first comment (non-fatal):', commentErr.message);
                    }
                }

                // 5. Mark as Published
                await supabase
                    .from('threads')
                    .update({
                        status: 'published',
                        scheduled_time: new Date().toISOString()
                    })
                    .eq('id', thread.id);

                console.log(`[Cron] Successfully published thread ${thread.id}`);
                results.push({ id: thread.id, status: 'published' });

            } catch (err) {
                console.error(`[Cron] Failed to publish thread ${thread.id}:`, err.message);

                await supabase
                    .from('threads')
                    .update({
                        status: 'failed',
                        error_message: err.message
                    })
                    .eq('id', thread.id);

                results.push({ id: thread.id, status: 'failed', error: err.message });
            }
        }

        return res.status(200).json({ success: true, results });

    } catch (err) {
        console.error('[Cron] Unexpected error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
