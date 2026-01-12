import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

// Initialize Supabase Admin Client (Service Role)
// Need this to read user tokens and update threads without RLS blocking
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // You need to add this to .env!

if (!supabaseServiceKey) {
    console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY is missing. Backend scheduler will not work.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey || 'placeholder');

// --- CRON SCHEDULER ---
// Runs every 10 seconds
cron.schedule('*/10 * * * * *', async () => {
    console.log('[Cron] Running scheduled checks...');

    if (!supabaseServiceKey) {
        console.error('[Cron] Skipped: Missing Service Role Key');
        return;
    }

    try {
        const now = new Date().toISOString();

        // 1. Fetch Due Threads
        // We only fetch threads that are strictly 'scheduled' and due.
        const { data: dueThreads, error } = await supabase
            .from('threads')
            .select('*')
            .eq('status', 'scheduled')
            .lte('scheduled_time', now);

        if (error) {
            console.error('[Cron] Error fetching threads:', error);
            return;
        }

        if (!dueThreads?.length) {
            // console.log('[Cron] No due threads.');
            return;
        }

        console.log(`[Cron] Found ${dueThreads.length} due threads. Processing...`);

        // 2. Process Each Thread
        for (const thread of dueThreads) {
            // LOCKING MECHANISM: Atomic Update
            // Try to set status to 'publishing'. If it fails (e.g. already changed), we skip.
            const { data: lockedThread, error: lockError } = await supabase
                .from('threads')
                .update({ status: 'publishing' })
                .eq('id', thread.id)
                .eq('status', 'scheduled') // Ensure it wasn't snatched by another process
                .select()
                .single();

            if (lockError || !lockedThread) {
                console.log(`[Cron] Could not lock thread ${thread.id}, skipping.`);
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
                    if (data.error) {
                        console.error('Threads API Error Details:', JSON.stringify(data.error, null, 2));
                        throw new Error(data.error.message);
                    }
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
                        console.log(`[Cron] Container ${containerId} status: ${statusData.status}`);

                        if (statusData.status === 'FINISHED') return true;
                        if (statusData.status === 'ERROR') {
                            throw new Error(`Media processing failed: ${statusData.error_message}`);
                        }

                        await new Promise(r => setTimeout(r, 5000)); // Wait 5s
                        attempts++;
                    }
                    throw new Error('Media processing timed out');
                };

                // --- A. Determine Post Type (Text vs Media vs Carousel) ---
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
                    // SINGLE MEDIA POST
                    const url = mediaUrls[0];
                    const isVideo = url.match(/\.(mp4|mov|avi|webm)($|\?)/i);
                    const params = new URLSearchParams();

                    params.append('media_type', isVideo ? 'VIDEO' : 'IMAGE');
                    params.append(isVideo ? 'video_url' : 'image_url', url);
                    params.append('text', thread.content);
                    params.append('access_token', accessToken);

                    const result = await postToThreads('threads', params);
                    creationId = result.id;

                    // Wait for it to be ready
                    await waitForMedia(creationId);

                } else {
                    // CAROUSEL POST
                    // 1. Create Item Containers for each media
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

                        // IMPORTANT: For video children, we might need to wait?
                        // Usually easier to assume we might need to wait for children before creating parent.
                        // Let's check status for all children just in case.
                        if (isVideo) {
                            await waitForMedia(itemResult.id);
                        }
                    }

                    // 2. Create Carousel Container
                    const carouselParams = new URLSearchParams();
                    carouselParams.append('media_type', 'CAROUSEL');
                    carouselParams.append('text', thread.content);
                    carouselParams.append('children', childrenIds.join(','));
                    carouselParams.append('access_token', accessToken);

                    const result = await postToThreads('threads', carouselParams);
                    creationId = result.id;

                    // Wait for Carousel to be ready
                    await waitForMedia(creationId);
                }

                if (!creationId) throw new Error('Failed to create container ID');

                // --- B. Publish Container ---
                const publishParams = new URLSearchParams();
                publishParams.append('creation_id', creationId);
                publishParams.append('access_token', accessToken);

                const publishResult = await postToThreads('threads_publish', publishParams);
                const publishedId = publishResult.id;

                // --- C. Post First Comment (if exists) ---
                if (thread.first_comment && publishedId) {
                    console.log(`[Cron] Posting first comment for thread ${thread.id}...`);
                    try {
                        const commentParams = new URLSearchParams();
                        commentParams.append('media_type', 'TEXT');
                        commentParams.append('text', thread.first_comment);
                        commentParams.append('reply_to_id', publishedId);
                        commentParams.append('access_token', accessToken);

                        // We need "threads_manage_replies" scope for this, assuming user granted it
                        const commentResult = await postToThreads('threads', commentParams);
                        const commentCreationId = commentResult.id;

                        const commentPublishParams = new URLSearchParams();
                        commentPublishParams.append('creation_id', commentCreationId);
                        commentPublishParams.append('access_token', accessToken);

                        await postToThreads('threads_publish', commentPublishParams);
                        console.log('[Cron] First comment published.');
                    } catch (commentErr) {
                        console.error('[Cron] Failed to publish first comment (non-fatal):', commentErr.message);
                    }
                }

                // 5. Mark as Published
                await supabase
                    .from('threads')
                    .update({
                        status: 'published',
                        scheduled_time: new Date().toISOString() // Update to actual publish time
                    })
                    .eq('id', thread.id);

                console.log(`[Cron] Successfully published thread ${thread.id}`);

                // --- 6. Cleanup Media (Save Storage) ---
                if (mediaUrls.length > 0) {
                    try {
                        const pathsToDelete = mediaUrls.map(url => {
                            try {
                                // Extract path after 'thread-media/'
                                const parts = url.split('/thread-media/');
                                return parts.length > 1 ? parts[1] : null;
                            } catch { return null; }
                        }).filter(Boolean);

                        if (pathsToDelete.length > 0) {
                            console.log(`[Cron] Cleaning up ${pathsToDelete.length} media files...`);
                            const { error: removeError } = await supabase.storage
                                .from('thread-media')
                                .remove(pathsToDelete);

                            if (removeError) {
                                console.error('[Cron] Failed to delete media:', removeError);
                            } else {
                                console.log('[Cron] Media cleanup successful.');
                            }
                        }
                    } catch (cleanupErr) {
                        console.error('[Cron] Error during media cleanup:', cleanupErr);
                    }
                }

            } catch (err) {
                console.error(`[Cron] Failed to publish thread ${thread.id}:`, err.message);

                // Mark as failed to stop retry loop
                await supabase
                    .from('threads')
                    .update({ status: 'failed' })
                    .eq('id', thread.id);
            }
        }

    } catch (err) {
        console.error('[Cron] Unexpected error:', err);
    }
});


// --- APP ROUTES ---

app.post('/exchange-token', async (req, res) => {
    try {
        console.log('Received /exchange-token request');

        const { code, redirect_uri } = req.body || {};

        if (!code) {
            return res.status(400).json({ error: 'Code is required' });
        }

        const params = new URLSearchParams();
        params.append('client_id', process.env.VITE_THREADS_APP_ID);
        params.append('client_secret', process.env.VITE_THREADS_APP_SECRET);
        params.append('grant_type', 'authorization_code');
        params.append('redirect_uri', redirect_uri || 'https://localhost:5173/auth/callback');
        params.append('code', code);

        const response = await fetch('https://graph.threads.net/oauth/access_token', {
            method: 'POST',
            body: params,
        });

        const text = await response.text();

        let data;
        try {
            const safeText = text.replace(/"user_id":\s*(\d+)/g, '"user_id": "$1"');
            data = JSON.parse(safeText);
        } catch (e) {
            return res.status(502).json({ error: 'Upstream Provider Error', details: text });
        }

        if (data.error) {
            return res.status(400).json(data);
        }

        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
    console.log('Backend Cron Scheduler is active.');
});
