require('dotenv').config({ path: __dirname + '/.env' });
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

console.log('Loaded AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID);

const s3 = new S3Client({ region: process.env.AWS_REGION });

async function testUpload() {
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: 'test-upload.txt',
    Body: 'Hello S3!',
    ContentType: 'text/plain',
  };

  try {
    await s3.send(new PutObjectCommand(params));
    console.log('✅ S3 upload succeeded!');
    console.log(`URL: https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/test-upload.txt`);
  } catch (err) {
    console.error('❌ S3 upload failed:', err);
  }
}

testUpload();