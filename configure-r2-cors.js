import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

console.log('Configuring CORS for bucket:', process.env.R2_BUCKET_NAME);

const command = new PutBucketCorsCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    CORSConfiguration: {
        CORSRules: [
            {
                AllowedHeaders: ["*"],
                AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
                AllowedOrigins: ["*"], // For production, might want to restrict to Vercel URL later
                ExposeHeaders: ["ETag"],
                MaxAgeSeconds: 3600
            }
        ]
    }
});

try {
    await r2.send(command);
    console.log('✅ CORS Configuration applied successfully!');
} catch (err) {
    console.error('❌ Failed to configure CORS:', err);
}
