import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
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

console.log('Testing R2 Connection...');
console.log('Account ID:', process.env.R2_ACCOUNT_ID);
console.log('Access Key:', process.env.R2_ACCESS_KEY_ID?.substring(0, 5) + '...');

try {
    const data = await r2.send(new ListBucketsCommand({}));
    console.log('✅ Connection Successful!');
    console.log('Buckets:', data.Buckets.map(b => b.Name).join(', '));
} catch (err) {
    console.error('❌ Connection Failed:', err);
}
