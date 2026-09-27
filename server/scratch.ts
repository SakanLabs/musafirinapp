import { Client as MinioClient } from 'minio';

const minioClient = new MinioClient({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'hotel-booking';

async function test() {
  try {
    const stream = await minioClient.getObject(BUCKET_NAME, 'invoices/INV-WEB-2026-9121.pdf');
    stream.on('data', function(chunk) {
      console.log('Got chunk of size:', chunk.length);
    });
    stream.on('end', function() {
      console.log('Stream ended');
    });
    stream.on('error', function(err) {
      console.log('Stream error:', err);
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
