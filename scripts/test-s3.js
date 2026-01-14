// test-s3.js - TRY PATH STYLE
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const HARDCODED_CONFIG = {
  region: 'sfo3',
  bucket: 'hale-project',
  accessKeyId: 'DO00JTQD8XWPQHHGTJ7K',
  secretAccessKey: 'Mij6txNAamFqYtbjyJZQo3z4I6ey3//o/TNlBLkEzpo',
  endpoint: 'https://sfo3.digitaloceanspaces.com'
};

// ✅ Try with forcePathStyle: true
const s3Client = new S3Client({
  endpoint: HARDCODED_CONFIG.endpoint,
  region: HARDCODED_CONFIG.region,
  credentials: {
    accessKeyId: HARDCODED_CONFIG.accessKeyId,
    secretAccessKey: HARDCODED_CONFIG.secretAccessKey
  },
  forcePathStyle: true,  // ✅ CHANGED TO TRUE
  maxAttempts: 1
});

async function testDirectUpload() {
  try {
    console.log('Testing with PATH STYLE access...');
    console.log('Config:', {
      endpoint: HARDCODED_CONFIG.endpoint,
      bucket: HARDCODED_CONFIG.bucket,
      region: HARDCODED_CONFIG.region,
      forcePathStyle: true
    });

    const testKey = `test-uploads/test-${Date.now()}.txt`;
    const testContent = 'Hello from Henderson Design - Path Style Test';

    const command = new PutObjectCommand({
      Bucket: HARDCODED_CONFIG.bucket,
      Key: testKey,
      Body: Buffer.from(testContent),
      ContentType: 'text/plain'
    });

    console.log('\nUploading test file...');
    const result = await s3Client.send(command);

    console.log('\n✅ SUCCESS WITH PATH STYLE!');
    console.log('ETag:', result.ETag);
    console.log('URL:', `https://hale-project.sfo3.digitaloceanspaces.com/${testKey}`);

  } catch (error) {
    console.log('\n❌ PATH STYLE ALSO FAILED');
    
    // ✅ Enhanced error logging
    console.error('Full error object:', JSON.stringify(error, null, 2));
    
    console.log('\nRequest details:', {
      endpoint: HARDCODED_CONFIG.endpoint,
      bucket: HARDCODED_CONFIG.bucket,
      region: HARDCODED_CONFIG.region,
      accessKeyLength: HARDCODED_CONFIG.accessKeyId?.length,
      secretKeyLength: HARDCODED_CONFIG.secretAccessKey?.length
    });
  }
}

testDirectUpload();